import app from '../app'

export default class HomeController {

  message: string;

  constructor() {
    this.message = 'It works!';
  }

}

app.controller('HomeController', HomeController);
