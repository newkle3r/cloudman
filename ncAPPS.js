import { clearConsole, checkComponent } from './utils.js';
import { GREEN, RED } from './color.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';

class ncAPPS {
    constructor(nextcloudPath = '/var/www/nextcloud') {
        this.occCommand = `${nextcloudPath}/occ`; // Path to the Nextcloud occ CLI
    }

    async manageApps(mainMenu) {
        let continueMenu = true;
        clearConsole();

        while (continueMenu) {
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
                        'List App Updates',
                        'Update Apps',
                        'Go Back'
                    ],
                }
            ]);

            switch (answers.action) {
                case 'List Installed Apps':
                    await this.listInstalledApps();
                    break;
                case 'Enable App':
                    await this.enableApp();
                    break;
                case 'Disable App':
                    await this.disableApp();
                    break;
                case 'Remove App':
                    await this.removeApp();
                    break;
                case 'List App Updates':
                    await this.listUpdates();
                    break;
                case 'Update Apps':
                    await this.updateApps();
                    break;
                case 'Go Back':
                    continueMenu = false;
                    if (typeof mainMenu === 'function') {
                        mainMenu(); // Make sure mainMenu is passed correctly
                    }
                    break;
            }
        }
    }

    async listInstalledApps() {
        clearConsole();
        const spinner = createSpinner('Fetching installed Nextcloud apps...').start();

        const output = checkComponent(`sudo -u www-data php ${this.occCommand} app:list`);
        if (output) {
            spinner.success({ text: `${GREEN('Installed Nextcloud apps:')}` });
            console.log(output);
        } else {
            spinner.error({ text: `${RED('Failed to list Nextcloud apps.')}` });
        }

        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageApps();
    }

    async enableApp() {
        clearConsole();
        const availableApps = await this.getAvailableApps();
        const { appName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'appName',
                message: 'Select the app to enable:',
                choices: availableApps
            }
        ]);

        const spinner = createSpinner(`Enabling app ${appName}...`).start();
        const output = checkComponent(`sudo -u www-data php ${this.occCommand} app:enable ${appName}`);

        if (output) {
            spinner.success({ text: `${GREEN(`App '${appName}' has been enabled!`)}` });
        } else {
            spinner.error({ text: `${RED(`Failed to enable app '${appName}'.`)}` });
        }

        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageApps();
    }

    async disableApp() {
        clearConsole();
        const installedApps = await this.getInstalledApps();
        const { appName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'appName',
                message: 'Select the app to disable:',
                choices: installedApps
            }
        ]);

        const spinner = createSpinner(`Disabling app ${appName}...`).start();
        const output = checkComponent(`sudo -u www-data php ${this.occCommand} app:disable ${appName}`);

        if (output) {
            spinner.success({ text: `${GREEN(`App '${appName}' has been disabled!`)}` });
        } else {
            spinner.error({ text: `${RED(`Failed to disable app '${appName}'.`)}` });
        }

        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageApps();
    }

    async removeApp() {
        clearConsole();
        const installedApps = await this.getInstalledApps();
        const { appName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'appName',
                message: 'Select the app to remove:',
                choices: installedApps
            }
        ]);

        const spinner = createSpinner(`Removing app ${appName}...`).start();
        const output = checkComponent(`sudo -u www-data php ${this.occCommand} app:remove ${appName}`);

        if (output) {
            spinner.success({ text: `${GREEN(`App '${appName}' has been removed!`)}` });
        } else {
            spinner.error({ text: `${RED(`Failed to remove app '${appName}'.`)}` });
        }

        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageApps();
    }

    async getInstalledApps() {
        const output = checkComponent(`sudo -u www-data php ${this.occCommand} app:list`);
        if (output) {
            const appList = output.match(/- (.*?)$/gm);
            return appList ? appList.map(app => app.replace('- ', '')) : [];
        } else {
            return [];
        }
    }

    async getAvailableApps() {
        const output = checkComponent(`sudo -u www-data php ${this.occCommand} app:list --shipped`);
        if (output) {
            const appList = output.match(/- (.*?)$/gm);
            return appList ? appList.map(app => app.replace('- ', '')) : [];
        } else {
            return [];
        }
    }
}

export default ncAPPS;
