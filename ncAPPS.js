import { clearConsole, checkComponent } from './utils.js';
import { GREEN, RED } from './color.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process'; 

class ncAPPS {
    constructor(nextcloudPath = '/var/www/nextcloud') {
        this.occCommand = `${nextcloudPath}/occ`; 
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
                        mainMenu();
                    }
                    break;
            }
        }
    }

    async listInstalledApps() {
        clearConsole();
        const spinner = createSpinner('Fetching installed Nextcloud apps...').start();

        const output = checkComponent(`sudo -u www-data php ${this.occCommand} app:list --shipped=true`);
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
    
        if (availableApps.length === 0) {
            console.log(RED('No available apps to enable.'));
            await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
            return this.manageApps();
        }
    
        availableApps.push('Abort');
    
        const { appName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'appName',
                message: 'Select the app to enable (or choose Abort to go back):',
                choices: availableApps
            }
        ]);
    
        if (appName === 'Abort') {
            return this.manageApps();
        }
    
        const appId = appName.split(':')[0]; 
    
        const spinner = createSpinner(`Enabling app ${appId}...`).start();
    
        try {
            checkComponent(`sudo -u www-data php ${this.occCommand} app:enable ${appId}`);
            spinner.success({ text: `${GREEN(`App '${appId}' has been enabled!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to enable app '${appId}'.`)}` });
            console.error(error);
        }
    
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageApps();
    }
    
    async disableApp() {
        clearConsole();
        const installedApps = await this.getInstalledApps();
    
        if (installedApps.length === 0) {
            console.log(RED('No installed apps to disable.'));
            await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
            return this.manageApps();
        }
    
        installedApps.push('Abort'); 
    
        const { appName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'appName',
                message: 'Select the app to disable (or choose Abort to go back):',
                choices: installedApps
            }
        ]);
    
        if (appName === 'Abort') {
            return this.manageApps();
        }
    
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
    
        if (installedApps.length === 0) {
            console.log(RED('No installed apps to remove.'));
            await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
            return this.manageApps();
        }
    
        installedApps.push('Abort');
    
        const { appName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'appName',
                message: 'Select the app to remove (or choose Abort to go back):',
                choices: installedApps
            }
        ]);
    
        if (appName === 'Abort') {
            return this.manageApps();
        }
    
        const appId = appName.split(':')[0];  // Extract only the app ID (e.g., sociallogin)
    
        const spinner = createSpinner(`Removing app ${appId}...`).start();
        
        try {
            checkComponent(`sudo -u www-data php ${this.occCommand} app:remove ${appId}`);
            spinner.success({ text: `${GREEN(`App '${appId}' has been removed!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to remove app '${appId}'.`)}` });
            console.error(error);
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
        const output = checkComponent(`sudo -u www-data php ${this.occCommand} app:list --shipped=true`);
        if (output) {
            const appList = output.match(/- (.*?)$/gm);
            if (appList && appList.length > 0) {
                return appList.map(app => app.replace('- ', ''));
            } else {
                console.error(RED('No available apps found.'));
                return [];
            }
        } else {
            console.error(RED('Failed to fetch available apps.'));
            return [];
        }
    }

    async listUpdates() {
        clearConsole();
        const spinner = createSpinner('Checking for available Nextcloud app updates...').start();
    
        try {
            const output = execSync(`sudo -u www-data php ${this.occCommand} update:check`, { encoding: 'utf8' });
            spinner.success({ text: `${GREEN('Available Nextcloud app updates:')}` });
            console.log(output);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to check for app updates.')}` });
            console.error(error);
        }
    
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageApps();
    }
    
    async updateApps() {
        clearConsole();
    
        // Prompt the user to update all apps or a specific app
        const { updateChoice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'updateChoice',
                message: 'Do you want to update all apps or a specific app?',
                choices: ['Update All Apps', 'Update Specific App', 'Abort']
            }
        ]);
    
        if (updateChoice === 'Abort') {
            return this.manageApps();
        }
    
        const spinner = createSpinner('Updating Nextcloud apps...').start();
    
        if (updateChoice === 'Update All Apps') {
            // Update all apps
            try {
                execSync(`sudo -u www-data php ${this.occCommand} app:update --all`, { encoding: 'utf8' });
                spinner.success({ text: `${GREEN('All Nextcloud apps updated successfully!')}` });
            } catch (error) {
                spinner.error({ text: `${RED('Failed to update all apps.')}` });
                console.error(error);
            }
        } else if (updateChoice === 'Update Specific App') {
            // Get a list of apps with available updates using the `update:check` command
            const availableUpdates = await this.getAvailableUpdates();
    
            if (availableUpdates.length === 0) {
                spinner.stop(); 
                console.log(RED('No apps with available updates.'));
                await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
                return this.manageApps();
            }
    
            // Allow the user to choose which app(s) to update
            const { appsToUpdate } = await inquirer.prompt([
                {
                    type: 'checkbox',
                    name: 'appsToUpdate',
                    message: 'Select the app(s) to update:',
                    choices: availableUpdates
                }
            ]);
    
            if (appsToUpdate.length === 0) {
                spinner.stop(); 
                console.log(RED('No apps selected for update.'));
                return this.manageApps();
            }
    
            // Update selected apps
            try {
                for (const appName of appsToUpdate) {
                    execSync(`sudo -u www-data php ${this.occCommand} app:update ${appName}`, { encoding: 'utf8' });
                    console.log(GREEN(`App '${appName}' updated successfully!`));
                }
                spinner.success({ text: `${GREEN('Selected apps updated successfully!')}` });
            } catch (error) {
                spinner.error({ text: `${RED('Failed to update one or more apps.')}` });
                console.error(error);
            }
        }
    
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageApps();
    }
    
    /**
     * Method to get a list of apps with available updates.
     * @returns {Array<string>} - List of app names with available updates.
     */
    async getAvailableUpdates() {
        const spinner = createSpinner('Checking for available Nextcloud app updates...').start();
    
        try {
            const output = execSync(`sudo -u www-data php ${this.occCommand} update:check`, { encoding: 'utf8' });
            spinner.stop();
    
            const appList = output.match(/- (.*?)$/gm);
            return appList ? appList.map(app => app.replace('- ', '')) : [];
        } catch (error) {
            spinner.stop(); 
            console.error(RED('Failed to fetch available updates.'));
            return [];
        }
    }
    
}

export default ncAPPS;
