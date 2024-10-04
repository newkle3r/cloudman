import ncUTILS from './ncUTILS.js';
import ncVARS from './ncVARS.js';
import { GREEN, RED, YELLOW, BLUE, PURPLE } from './color.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process'; 

class ncAPPS {
    constructor(mainMenu) {
        let util = new ncUTILS();
        let lib = new ncVARS();
        util.clearConsole();
        lib.loadVariables();
        this.NCPATH = lib.NCPATH;
        this.appUpdateStatus = YELLOW('Checking for app updates...');
        this.awaitContinue = awaitContinue;
        this.mainMenu = typeof mainMenu === 'function' ? mainMenu : () => console.log('Main menu is not available.');
    }

    async manageApps() {
        let continueMenu = true;
        util.clearConsole();

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
                    break;
            }
        }

        // Once the loop finishes, go back to the main menu.
        await this.mainMenu();
    }


    async listInstalledApps() {
        util.clearConsole();
        const spinner = createSpinner('Fetching installed Nextcloud apps...').start();

        const output = runCommand(`sudo -u www-data php /var/www/nextcloud/occ app:list --shipped=true`);
        if (output) {
            spinner.success({ text: `${GREEN('Installed Nextcloud apps:')}` });
            console.log(output);
        } else {
            spinner.error({ text: `${RED('Failed to list Nextcloud apps.')}` });
        }

        await this.awaitContinue();
        await this.manageApps();
    }

    async enableApp() {
        util.clearConsole();
        const availableApps = await this.getAvailableApps();
    
        if (availableApps.length === 0) {
            console.log(RED('No available apps to enable.'));
            await this.awaitContinue();
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
            runCommand(`sudo -u www-data php /var/www/nextcloud/occ app:enable ${appId}`);
            spinner.success({ text: `${GREEN(`App '${appId}' has been enabled!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to enable app '${appId}'.`)}` });
            console.error(error);
        }
    
        await this.awaitContinue();
        await this.manageApps();
    }
    
    async disableApp() {
        util.clearConsole();
        const installedApps = await this.getInstalledApps();
    
        if (installedApps.length === 0) {
            console.log(RED('No installed apps to disable.'));
            await this.awaitContinue();
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
        const output = runCommand(`sudo -u www-data php /var/www/nextcloud/occ app:disable ${appName}`);
    
        if (output) {
            spinner.success({ text: `${GREEN(`App '${appName}' has been disabled!`)}` });
        } else {
            spinner.error({ text: `${RED(`Failed to disable app '${appName}'.`)}` });
        }
    
        await this.awaitContinue();
        await this.manageApps();
    }
    
    async removeApp() {
        util.clearConsole();
        const installedApps = await this.getInstalledApps();
    
        if (installedApps.length === 0) {
            console.log(RED('No installed apps to remove.'));
            await this.awaitContinue();
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
            runCommand(`sudo -u www-data php /var/www/nextcloud/occ app:remove ${appId}`);
            spinner.success({ text: `${GREEN(`App '${appId}' has been removed!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to remove app '${appId}'.`)}` });
            console.error(error);
        }
    
        await this.awaitContinue();
        await this.manageApps();
    }

    async getInstalledApps() {
        const output = runCommand(`sudo -u www-data php /var/www/nextcloud/occ app:list`);
        if (output) {
            const appList = output.match(/- (.*?)$/gm);
            return appList ? appList.map(app => app.replace('- ', '')) : [];
        } else {
            return [];
        }
    }

    async getAvailableApps() {
        const output = runCommand(`sudo -u www-data php /var/www/nextcloud/occ app:list --shipped=true`);
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
        util.clearConsole();
        const spinner = createSpinner('Checking for available Nextcloud updates...').start();
        
        try {
            // Run the `occ update:check` command to check for both core and app updates
            const output = execSync(`sudo -u www-data php /var/www/nextcloud/occ update:check`, { encoding: 'utf8' });
            
            spinner.success({ text: `${GREEN('Available Nextcloud updates:')}` });
            
            // Display the full output for debugging purposes
            console.log(output);
            
            // Parse app update information
            const appUpdates = output.match(/Update for (.+?) to version (\d+\.\d+\.\d+) is available/g);
            if (appUpdates && appUpdates.length > 0) {
                this.appUpdateStatus = GREEN(`${appUpdates.length} app update(s) available.`);
            } else {
                this.appUpdateStatus = YELLOW('No app updates available.');
            }

            // Parse core update information
            const coreUpdate = output.match(/Nextcloud\s+(\d+\.\d+\.\d+)\s+is available/);
            if (coreUpdate) {
                console.log(GREEN(`Nextcloud update available: Version ${coreUpdate[1]}`));
            }

            
    
        } catch (error) {
            this.appUpdateStatus = RED('Failed to check for updates.');
            spinner.error({ text: `${RED('Failed to check for Nextcloud updates.')}` });
            console.error(error);
        }
    
        await this.awaitContinue();
        await this.manageApps();
    }
    
    
    async updateApps() {
        util.clearConsole();
    
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
    
        if (updateChoice === 'Update All Apps') {
            const spinner = createSpinner('Updating all Nextcloud apps...').start();
            try {
                execSync(`sudo -u www-data php /var/www/nextcloud/occ app:update --all`, { encoding: 'utf8' });
                spinner.success({ text: `${GREEN('All Nextcloud apps updated successfully!')}` });
            } catch (error) {
                spinner.error({ text: `${RED('Failed to update all apps.')}` });
                console.error(error);
            }
        } else if (updateChoice === 'Update Specific App') {
            // Fetch available app updates
            const availableUpdates = await this.getAvailableUpdates();
    
            if (availableUpdates.length === 0) {
                console.log(RED('No apps with available updates.'));
                await this.awaitContinue();
                return this.manageApps();
            }
    
            // Stop spinner after fetching available updates
            const { appsToUpdate } = await inquirer.prompt([
                {
                    type: 'checkbox',
                    name: 'appsToUpdate',
                    message: 'Select the app(s) to update:',
                    choices: [...availableUpdates, 'Abort']
                }
            ]);

            if (appsToUpdate.includes('Abort')) {
                console.log(YELLOW('Update aborted.'));
                return this.manageApps();
            }
    
            if (appsToUpdate.length === 0) {
                console.log(RED('No apps selected for update.'));
                return this.manageApps();
            }
    
            // Start a spinner for updating selected apps
            const spinner = createSpinner('Updating selected Nextcloud apps...').start();
    
            try {
                for (const appName of appsToUpdate) {
                    execSync(`sudo -u www-data php /var/www/nextcloud/occ app:update ${appName}`, { encoding: 'utf8' });
                    console.log(GREEN(`App '${appName}' updated successfully!`));
                }
                spinner.success({ text: `${GREEN('Selected apps updated successfully!')}` });
            } catch (error) {
                spinner.error({ text: `${RED('Failed to update one or more apps.')}` });
                console.error(error);
            }
        }
    
        await this.awaitContinue();
        await this.manageApps();
    }
    
    
    /**
     * Method to get a list of apps with available updates.
     * @returns {Array<string>} - List of app names with available updates.
     */
    async getAvailableUpdates() {
        const spinner = createSpinner('Checking for available Nextcloud app updates...').start();
    
        try {
            const output = execSync(`sudo -u www-data php /var/www/nextcloud/occ update:check`, { encoding: 'utf8' });
            spinner.stop();
    
            // Extract app updates from the output
            const appUpdates = output.match(/Update for (.+?) to version (\d+\.\d+\.\d+) is available/g);
    
            if (appUpdates && appUpdates.length > 0) {
                return appUpdates.map(update => update.match(/Update for (.+?) to/)[1]);  // Extract app names
            } else {
                return [];
            }
        } catch (error) {
            spinner.stop(); 
            console.error(RED('Failed to fetch available updates.'));
            return [];
        }
    }
    
    
}

export default ncAPPS;
