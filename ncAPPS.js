import { clearConsole,welcome,checkComponent } from './utils.js';
import { GREEN, RED } from './color.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';

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
                    mainMenu(); 
                    break;
            }
        }
    }

    /**
     * Lists all installed Nextcloud apps.
     */
    async listInstalledApps() {
        clearConsole();
        const spinner = createSpinner('Fetching installed Nextcloud apps...').start();

        try {
            const output = checkComponent(`sudo -u www-data php ${this.occCommand} app:list`, { encoding: 'utf8' });
            spinner.success({ text: `${GREEN('Installed Nextcloud apps:')}` });
            console.log(output);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to list Nextcloud apps.')}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageApps();
    }

    /**
     * Enables a specified Nextcloud app from a selectable list.
     */
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

        try {
            checkComponent(`sudo -u www-data php ${this.occCommand} app:enable ${appName}`);
            spinner.success({ text: `${GREEN(`App '${appName}' has been enabled!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to enable app '${appName}'.`)}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageApps();
    }

    /**
     * Disables a specified Nextcloud app from a selectable list.
     */
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

        try {
            execSync(`sudo -u www-data php ${this.occCommand} app:disable ${appName}`);
            spinner.success({ text: `${GREEN(`App '${appName}' has been disabled!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to disable app '${appName}'.`)}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageApps();
    }

    /**
     * Removes a specified Nextcloud app from a selectable list.
     */
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

        try {
            execSync(`sudo -u www-data php ${this.occCommand} app:remove ${appName}`);
            spinner.success({ text: `${GREEN(`App '${appName}' has been removed!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to remove app '${appName}'.`)}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageApps();
    }

    /**
     * Lists available app updates.
     */
    async listUpdates() {
        clearConsole();
        const spinner = createSpinner('Checking for app updates...').start();

        try {
            const output = execSync(`sudo -u www-data php ${this.occCommand} app:update --list`, { encoding: 'utf8' });
            spinner.success({ text: `${GREEN('Available updates:')}` });
            console.log(output);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to list app updates.')}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageApps();
    }

    /**
     * Updates apps from a selectable list of upgradable apps.
     */
    async updateApps() {
        clearConsole();
        const availableUpdates = await this.getAvailableUpdates();
        const { appsToUpdate } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'appsToUpdate',
                message: 'Select the apps to update:',
                choices: availableUpdates
            }
        ]);

        const spinner = createSpinner('Updating selected apps...').start();

        try {
            for (const appName of appsToUpdate) {
                execSync(`sudo -u www-data php ${this.occCommand} app:update ${appName}`);
                console.log(GREEN(`Updated '${appName}' successfully!`));
            }
            spinner.success({ text: `${GREEN('Selected apps updated successfully!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to update one or more apps.')}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageApps();
    }



/**
 * Method to get a list of installed apps.
 * @returns {Array<string>} - List of installed app names.
 */
async getInstalledApps() {
    clearConsole();
    try {
        const command = `sudo -u www-data php ${this.occCommand} app:list`;
        const success = await checkComponent(command);

        if (success) {
            const output = execSync(command, { encoding: 'utf8' });
            const appList = output.match(/- (.*?)$/gm);
            return appList ? appList.map(app => app.replace('- ', '')) : [];
        } else {
            console.error(RED('Failed to fetch installed apps.'));

        }
    } catch (error) {
        console.error(RED('Error executing command.'));

    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    await this.manageApps();
}

/**
 * Method to get a list of available apps (excluding installed ones).
 * @returns {Array<string>} - List of available app names.
 */
async getAvailableApps() {
    clearConsole();
    try {
        const command = `sudo -u www-data php ${this.occCommand} app:list --shipped`;
        const success = await checkComponent(command);

        if (success) {
            const output = execSync(command, { encoding: 'utf8' });
            const appList = output.match(/- (.*?)$/gm);
            return appList ? appList.map(app => app.replace('- ', '')) : [];
        } else {
            console.error(RED('Failed to fetch available apps.'));

        }
    } catch (error) {
        console.error(RED('Error executing command.'));
  
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    await this.manageApps();
}

/**
 * Method to get a list of apps with available updates.
 * @returns {Array<string>} - List of upgradable app names.
 */
async getAvailableUpdates() {
    try {
        const command = `sudo -u www-data php ${this.occCommand} app:update --list`;
        const success = await checkComponent(command);

        if (success) {
            const output = execSync(command, { encoding: 'utf8' });
            const appList = output.match(/- (.*?)$/gm);
            return appList ? appList.map(app => app.replace('- ', '')) : [];
        } else {
            console.error(RED('Failed to fetch available updates.'));
       
        }
    } catch (error) {
        console.error(RED('Error executing command.'));

    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    await this.manageApps();
}
    
}

export default ncAPPS;
