import { GREEN,RED } from './color.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';
import chalk from 'chalk';



/**
 * Class to manage Nextcloud apps using the occ CLI.
 */
class ncAPPS {
    constructor(nextcloudPath = '/var/www/nextcloud') {
        this.occCommand = `${nextcloudPath}/occ`;  // Path to the Nextcloud occ CLI
    }

    /**
     * Displays the menu for Nextcloud app management.
     */
    async manageApps(mainMenu) {
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Nextcloud App Management:',
                choices: [
                    'List Installed Apps',
                    'Enable App',
                    'Disable App',
                    'Remove App',
                    'Go Back'
                ],
            }
        ]);

        switch (answers.action) {
            case 'List Installed Apps':
                return this.listInstalledApps();
            case 'Enable App':
                return this.enableApp();
            case 'Disable App':
                return this.disableApp();
            case 'Remove App':
                return this.removeApp();
            case 'Go Back':
                mainMenu();
                break;
                
        }
    }

    /**
     * Lists all installed Nextcloud apps.
     */
    async listInstalledApps() {
        const spinner = createSpinner('Fetching installed Nextcloud apps...').start();
        
        try {
            const output = execSync(`sudo -u www-data php ${this.occCommand} app:list`, { encoding: 'utf8' });
            spinner.success({ text: `${GREEN('Installed Nextcloud apps:')}` });
            console.log(output);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to list Nextcloud apps.')}` });
            console.error(error);
        }

        await this.manageApps();
    }

    /**
     * Enables a specified Nextcloud app.
     */
    async enableApp() {
        const { appName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'appName',
                message: 'Enter the app name you want to enable:'
            }
        ]);

        const spinner = createSpinner(`Enabling app ${appName}...`).start();

        try {
            execSync(`sudo -u www-data php ${this.occCommand} app:enable ${appName}`);
            spinner.success({ text: `${GREEN(`App '${appName}' has been enabled!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to enable app '${appName}'.`)}` });
            console.error(error);
        }

        await this.manageApps();
    }

    /**
     * Disables a specified Nextcloud app.
     */
    async disableApp() {
        const { appName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'appName',
                message: 'Enter the app name you want to disable:'
            }
        ]);

        const spinner = createSpinner(`Disabling app ${appName}...`).start();

        try {
            execSync(`sudo -u www-data php ${this.occCommand} app:disable ${appName}`);
            spinner.success({ text: `${GREEN(`App '${appName}' has been disabled!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to disable app '${appName}'.`)}` });
            console.error(error);
        }

        await this.manageApps();
    }

    /**
     * Removes a specified Nextcloud app.
     */
    async removeApp() {
        const { appName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'appName',
                message: 'Enter the app name you want to remove:'
            }
        ]);

        const spinner = createSpinner(`Removing app ${appName}...`).start();

        try {
            execSync(`sudo -u www-data php ${this.occCommand} app:remove ${appName}`);
            spinner.success({ text: `${GREEN(`App '${appName}' has been removed!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to remove app '${appName}'.`)}` });
            console.error(error);
        }

        await this.manageApps();
    }
}

export default ncAPPS;
