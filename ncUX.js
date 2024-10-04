import ncUTILS from './ncUTILS.js';
import { PURPLE } from './color.js';
import inquirer from 'inquirer';
import gradient from 'gradient-string';
import chalkAnimation from 'chalk-animation';

import figlet from 'figlet';


class ncUX {
    constructor() {
        this.util = new ncUTILS();
        
        

    }
    

    /**
     * Displays a splash welcome screen with system information.
     */
    async welcome() {
        const linkText = 'Want a professional to just fix it for you? Click here!';
        const url = 'https://shop.hanssonit.se/product-category/support/';
        this.util.clearConsole();
        console.log(`\x1B]8;;${url}\x07${PURPLE(linkText)}\x1B]8;;\x07`);

        const rainbowTitle = chalkAnimation.rainbow(
            'Nextcloud instance manager by T&M Hansson IT \n'
        );
        
        await new Promise((resolve) => setTimeout(resolve, 1000));
        rainbowTitle.stop();

        console.log(
            gradient.pastel.multiline(
                figlet.textSync('Cloudman', { horizontalLayout: 'full' })
            )
        );
    }

}
export default ncUX;