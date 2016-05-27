var gulp = require('gulp');
var rollup = require('rollup-stream');
var typescript = require('rollup-plugin-typescript');
var nodeResolve = require('rollup-plugin-node-resolve');
var sourcemaps = require('gulp-sourcemaps');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var annotate = require('gulp-ng-annotate');
var cached = require('gulp-cached');
var htmlhint = require('gulp-htmlhint');
var htmlmin = require('gulp-htmlmin');
var remember = require('gulp-remember');
var newer = require('gulp-newer');
var templatecache = require('gulp-angular-templatecache');
var inject = require('gulp-inject');
var autoprefixer = require('autoprefixer');
var mqpacker = require('css-mqpacker');
var csswring = require('csswring');
var filter = require('gulp-filter');
var sass = require('gulp-sass');
var postcss = require('gulp-postcss');
var atImport = require("postcss-import");
var watch = require('gulp-watch');
var browserSync = require('browser-sync').create();
var notifier = require('node-notifier');
var gutil = require('gulp-util');
var uglify = require('gulp-uglify');
var _ = require('lodash');
var proxy = require('proxy-middleware');
var url = require('url');
var $if = require('gulp-if');
var imagemin = require('gulp-imagemin');
var karma = require('karma').Server;

var watching = false;

try {
  var localConfig = require('./config.local.json');
  console.log('Found local config.')
}
catch(e) {}

var config = _.defaults(localConfig || {}, {
  uglify: true,
  port: 3500,
  endpoints: {
    default: ''
  }
})

var watching = _.intersection(process.argv, _.keys(config.endpoints)).length > 0;

function clearCaches(paths) {
  _.each(paths, p => {
    _.each(['templates'], c => {
      if (typeof cached.caches[c][p] != 'undefined') {
        delete cached.caches[c][p];
        remember.forget(c, p);
      }
    })
  });
}

function notifyError(error) {
  notifier.notify({
    title: '<%=name %> build',
    message: error,
    sound: true
  });
}

function compile(entryPoint, outDir, outFile, reload, cb) {
  return rollup({
    entry: entryPoint,
    plugins: [
      typescript(),
      nodeResolve({
        jsnext: true,
        main: true,
        browser: true,
        extensions: ['.js', '.json'],
        preferBuiltins: false
      })
    ],
    sourceMap: true
  })
    .on('error', function(e){
      notifyError('TypeScript compilation failed');
      var message = new gutil.PluginError('rollup', e).toString();
      process.stderr.write(message + '\n');
      if (!watching) process.exit(1);
      this.emit('end');
    })
    .pipe(source(outFile, './src'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(annotate())
    .pipe($if(config.uglify, uglify()))
    .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '/src' }))
    .pipe(cached('scripts'))
    .pipe(gulp.dest(outDir))
    .pipe($if(reload, browserSync.stream({match: '**/*.js'})));
}

gulp.task('clean', cb => {
  var del = require('del');
  del(['build/**/*', '.tmp/**/*'], cb);
});

gulp.task('sass', (cb) => {
  var mainFilter = filter('src/main.scss', { restore: true });

  return gulp.src('src/main.scss')
    .pipe(inject(gulp.src('src/**/_*.scss', { read: false }), {
      starttag: '/* inject:imports */',
      endtag: '/* endinject */',
      transform: function(filepath) {
        return '@import ".' + filepath + '";';
      }
    }))
    .pipe(sourcemaps.init({ debug: true }))
    .pipe(sass({ precision: 10 }))
    .on('error', function(e) {
      notifyError('Sass compilation error.');
      var message = new gutil.PluginError('sass', e.messageFormatted).toString();
      process.stderr.write(message + '\n');
      if (!watching) process.exit(1);
      this.emit('end');
    })
    .pipe(postcss([
      atImport(),
      autoprefixer({ browsers: ['last 2 versions'] }),
      mqpacker({ sort: true }),
      csswring({ removeAllComments: true })
    ]))
    .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '/src' }))
    .pipe(cached('sass'))
    .pipe(gulp.dest('build/css'))
    .pipe(browserSync.stream({match: '**/*.css'}));
});

gulp.task('templates', (cb) => {
  return gulp.src(['src/**/*.html', '!src/index.html', '!src/embed*.html'])
    .pipe(cached('templates'))
    .pipe(htmlhint('.htmlhintrc'))
    .pipe(htmlhint.reporter())
    .pipe(htmlhint.failReporter()).on('error', function(e) {
      notifyError('Error found in a HTML template.');
      new gutil.PluginError('htmlhint', e).toString();
      if (!watching) process.exit(1);
      this.emit('end');
    })
    .pipe(htmlmin({
      collapseWhitespace: true,
      conservativeCollapse: true,
      removeComments: true,
      collapseBooleanAttributes: true,
      removeAttributeQuotes: true,
      removeRedundantAttributes: true,
      removeEmptyAttributes: true
    }))
    .pipe(remember('templates'))
    .pipe(newer('.tmp/templates.js'))
    .pipe(templatecache({ standalone: true }))
    .pipe(gulp.dest('.tmp/'))
});

gulp.task('images', () => {
  return gulp.src('src/images/**/*')
    .pipe(cached('images'))
    .pipe(imagemin())
    .pipe(gulp.dest('build/images'))
    .pipe(browserSync.stream({match: '**/*.*'}));
});

gulp.task('compile', ['templates'], (cb) => {
  return compile('src/index.ts', 'build/js', 'main.js', true, cb);
});

gulp.task('inject-specs', () => {
  return gulp.src('src/spec.ts')
    .pipe(inject(gulp.src('src/**/*.spec.ts', { read: false }), {
      starttag: '/* inject:specs */',
      endtag: '/* endinject */',
      transform: function(filepath) {
        return "import '.." + filepath + "';";
      }
    }))
    .pipe(gulp.dest('.tmp/'));
});

gulp.task('compile:spec', ['inject-specs'], (cb) => {
  return compile('.tmp/spec.ts', '.tmp', 'spec.js', false, cb);
});

gulp.task('root', () => {
  return gulp.src('src/index.html')
    .pipe(newer('build'))
    .pipe(gulp.dest('build'))
    .pipe(browserSync.stream());
});

gulp.task('build', ['compile', 'sass', 'images', 'root']);

gulp.task('spec', ['build', 'compile:spec'], (cb) => {
  var path = require('path');
  new karma(
    { configFile: path.resolve('karma.conf.js') },
    (exitCode) => {
      console.log('exit code', exitCode)
      if (exitCode != 0) {
        notifyError('Some specs failed');
        if (!watching) process.exit(1);
      }
      cb();
    }).start();
});

_.forEach(config.endpoints, (apiUrl, name) => {
  gulp.task(name, ['build'], () => {
    watch(['src/**/*', 'package.json'], (vinyl) => {
      if (vinyl.event == 'unlink') {
        clearCaches(vinyl.history);
      }
      gulp.start('build');
    });
    
    var middleware = [];
    if (apiUrl) {
      middleware.push(
        proxy(_.merge(url.parse(apiUrl), {
          route: '/api',
          cookieRewrite: 'rightscale.local'
        })));
    }

    browserSync.init({
      open: false,
      port: config.port,
      reloadOnRestart: true,
      ui: {
        port: config.port + 1
      },
      server: {
        baseDir: ['build', '.'], // allows serving sourcemaps
        middleware: middleware
      }
    })
  });
});
