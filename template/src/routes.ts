import app from './app'
import HomeController from './home/home.controller'

app.config((
  $stateProvider: ng.ui.IStateProvider,
  $urlRouterProvider: ng.ui.IUrlRouterProvider
) => {
  $urlRouterProvider.otherwise('/');

  $stateProvider
    .state('home', {
      url: '/',
      templateUrl: 'home/home.html',
      controller: HomeController,
      controllerAs: '$ctrl'
    });
});
