import app from './app';

app.config((
  $provide: ng.auto.IProvideService,
  $compileProvider: ng.ICompileProvider
) => {
  // Hijacks the Angular exception handler to rethrow exceptions that work with source maps on Chrome
  $provide.decorator('$exceptionHandler', ($delegate: any) => {
    return (exception: any, cause: any) => {
      setTimeout(() => {
        throw exception;
      });
    };
  });
})
