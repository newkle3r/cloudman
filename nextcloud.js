import { RED,GREEN } from './color.js';
import chalk from 'chalk';
import inquirer from 'inquirer';
import gradient from 'gradient-string';
import chalkAnimation from 'chalk-animation';

import figlet from 'figlet';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';



class noVMNC {

    
    async installNextcloud() {
        const spinner = createSpinner('Installing Nextcloud...').start();
        
        try {
            execSync('sudo apt update && sudo apt install nextcloud -y');
            spinner.success({ text: `${GREEN('Nextcloud has been installed!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to install Nextcloud')}` });
            console.error(error);
        }
    }

    async updateNextcloud() {
        const spinner = createSpinner('Updating Nextcloud...').start();
        
        try {
            execSync('sudo nextcloud upgrade');
            spinner.success({ text: `${GREEN('Nextcloud has been updated!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to update Nextcloud')}` });
            console.error(error);
        }
    }

    async repairNextcloud(mainMenu) {
        const spinner = createSpinner('Repairing Nextcloud...').start();
        
        try {
            execSync('sudo nextcloud_occ maintenance:repair');
            spinner.success({ text: `${GREEN('Nextcloud has been repaired!')}` });
            mainMenu();
        } catch (error) {
            spinner.error({ text: `${RED('Failed to repair Nextcloud')}` });
            console.error(error);
            mainMenu();
        }
    }
}

export default noVMNC;
