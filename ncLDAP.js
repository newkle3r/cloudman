import { GREEN, RED } from './color.js';
import { clearConsole,welcome } from './ncUTILS.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';

/**
 * Class to manage LDAP settings and users for both Nextcloud and Ubuntu.
 */
class ncLDAP {
    constructor(nextcloudPath = '/var/www/nextcloud') {
        this.occCommand = `${nextcloudPath}/occ`;  // Path to the Nextcloud occ CLI
    }

    /**
     * Displays the menu for LDAP management.
     */
    async manageLDAP(mainMenu) {
        let continueMenu = true;

        while (continueMenu) {
            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'LDAP Management:',
                    choices: [
                        'Configure LDAP for Nextcloud',
                        'Add LDAP User to Ubuntu',
                        'Remove LDAP User from Ubuntu',
                        'List LDAP Users in Ubuntu',
                        'Test LDAP Connection for Nextcloud',
                        'Go Back'
                    ],
                }
            ]);

            switch (answers.action) {
                case 'Configure LDAP for Nextcloud':
                    await this.configureNextcloudLDAP();
                    break;
                case 'Add LDAP User to Ubuntu':
                    await this.addLDAPUserToUbuntu();
                    break;
                case 'Remove LDAP User from Ubuntu':
                    await this.removeLDAPUserFromUbuntu();
                    break;
                case 'List LDAP Users in Ubuntu':
                    await this.listLDAPUsers();
                    break;
                case 'Test LDAP Connection for Nextcloud':
                    await this.testNextcloudLDAP();
                    break;
                case 'Go Back':
                    continueMenu = false;
                    mainMenu();
                    break;
            }
        }
    }

    /**
     * Configures LDAP for Nextcloud.
     */
    async configureNextcloudLDAP() {
        const spinner = createSpinner('Configuring LDAP for Nextcloud...').start();

        try {
            execSync(`sudo -u www-data php ${this.occCommand} ldap:show-config`, { encoding: 'utf8' });
            spinner.success({ text: `${GREEN('LDAP configured for Nextcloud.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to configure LDAP for Nextcloud.')}` });
            console.error(error);
        }
    }

    /**
     * Adds an LDAP user to Ubuntu.
     */
    async addLDAPUserToUbuntu() {
        const { ldapUsername } = await inquirer.prompt([
            {
                type: 'input',
                name: 'ldapUsername',
                message: 'Enter the LDAP username to add to Ubuntu:'
            }
        ]);

        const spinner = createSpinner(`Adding LDAP user ${ldapUsername} to Ubuntu...`).start();

        try {
            execSync(`sudo adduser --disabled-password --gecos "" ${ldapUsername}`);
            spinner.success({ text: `${GREEN(`LDAP user '${ldapUsername}' added to Ubuntu.`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to add LDAP user '${ldapUsername}' to Ubuntu.`)}` });
            console.error(error);
        }
    }

    /**
     * Removes an LDAP user from Ubuntu.
     */
    async removeLDAPUserFromUbuntu() {
        const { ldapUsername } = await inquirer.prompt([
            {
                type: 'input',
                name: 'ldapUsername',
                message: 'Enter the LDAP username to remove from Ubuntu:'
            }
        ]);

        const spinner = createSpinner(`Removing LDAP user ${ldapUsername} from Ubuntu...`).start();

        try {
            execSync(`sudo deluser ${ldapUsername}`);
            spinner.success({ text: `${GREEN(`LDAP user '${ldapUsername}' removed from Ubuntu.`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to remove LDAP user '${ldapUsername}' from Ubuntu.`)}` });
            console.error(error);
        }
    }

    /**
     * Lists all LDAP users in Ubuntu.
     */
    async listLDAPUsers() {
        const spinner = createSpinner('Listing LDAP users in Ubuntu...').start();

        try {
            const ldapUsers = execSync(`getent passwd | grep -v '/nologin' | grep '/home'`, { encoding: 'utf8' });
            spinner.success({ text: `${GREEN('LDAP Users in Ubuntu:')}` });
            console.log(ldapUsers);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to list LDAP users in Ubuntu.')}` });
            console.error(error);
        }
    }

    /**
     * Tests the LDAP connection for Nextcloud.
     */
    async testNextcloudLDAP() {
        const spinner = createSpinner('Testing LDAP connection for Nextcloud...').start();

        try {
            const output = execSync(`sudo -u www-data php ${this.occCommand} ldap:test-config`, { encoding: 'utf8' });
            spinner.success({ text: `${GREEN('LDAP connection test successful!')}` });
            console.log(output);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to test LDAP connection for Nextcloud.')}` });
            console.error(error);
        }
    }
}

export default ncLDAP;
