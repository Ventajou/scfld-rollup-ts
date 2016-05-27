module.exports = {
  init: function() {
    var path = require('path');
    var q = require('q').defer();
    var inquirer = require('inquirer');

    var questions = [
      {
        type: 'input',
        name: 'name',
        message: "What is your project's name?"
      },
      {
        type: 'input',
        name: 'description',
        message: 'Please give a short description for your project:'
      },
      {
        type: 'input',
        name: 'author',
        message: "Who is the project's owner?"
      },
      {
        type: 'input',
        name: 'license',
        message: 'Which license are you using for this project?'
      }
    ];

    console.log('\n  A Scfld plugin to generate front-end TypeScript projects bundled with Rollup\n');

    inquirer.prompt(questions, function(answers) {
      q.resolve({
        options: {
          data: answers
        },
        sources: [
          path.join(__dirname, 'template')
        ],
        globalDeps: ['gulp', 'typings'],
        postInit: [
          'npm i',
          'typings install'
        ]
      })
    });

    return q.promise;
  }
}
