import { execSync } from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { createSpinner } from 'nanospinner';

const GREEN = chalk.green;
const RED = chalk.redBright;
const YELLOW = chalk.yellow;

/**
 * Class to manage LDAP configurations and tasks for both Ubuntu and Nextcloud.
 */
class ncLDAP {
    constructor() {
        this.occCommand = '/var/www/nextcloud/occ'; // Path to Nextcloud occ command
    }

    /**
     * Displays the menu for LDAP-related tasks.
     */
    async manageLDAP() {
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
                return this.configureNextcloudLDAP();
            case 'Add LDAP User to Ubuntu':
                return this.addLDAPUserToUbuntu();
            case 'Remove LDAP User from Ubuntu':
                return this.removeLDAPUserFromUbuntu();
            case 'List LDAP Users in Ubuntu':
                return this.listLDAPUsers();
            case 'Test LDAP Connection for Nextcloud':
                return this.testNextcloudLDAP();
            case 'Go Back':
                return;  // Exit or go back to the main menu
        }
    }

    /**
     * Configures LDAP for Nextcloud using occ commands.
     */
    async configureNextcloudLDAP() {
        const { ldapHost, ldapBaseDN, ldapUserDN, ldapPassword } = await inquirer.prompt([
            { type: 'input', name: 'ldapHost', message: 'Enter LDAP server host:' },
            { type: 'input', name: 'ldapBaseDN', message: 'Enter LDAP Base DN:' },
            { type: 'input', name: 'ldapUserDN', message: 'Enter LDAP Admin User DN:' },
            { type: 'password', name: 'ldapPassword', message: 'Enter LDAP Admin Password:' }
        ]);

        const spinner = createSpinner('Configuring LDAP for Nextcloud...').start();

        try {
            execSync(`sudo -u www-data php ${this.occCommand} ldap:set-config s01 ldapHost ${ldapHost}`);
            execSync(`sudo -u www-data php ${this.occCommand} ldap:set-config s01 ldapBase ${ldapBaseDN}`);
            execSync(`sudo -u www-data php ${this.occCommand} ldap:set-config s01 ldapUserDn ${ldapUserDN}`);
            execSync(`sudo -u www-data php ${this.occCommand} ldap:set-config s01 ldapAgentPassword ${ldapPassword}`);
            execSync(`sudo -u www-data php ${this.occCommand} ldap:test-config s01`);
            spinner.success({ text: `${GREEN('LDAP configuration for Nextcloud completed!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to configure LDAP for Nextcloud!')}` });
            console.error(error);
        }

        await this.manageLDAP();
    }

    /**
     * Adds an LDAP user to Ubuntu.
     */
    async addLDAPUserToUbuntu() {
        const { username, password, baseDN } = await inquirer.prompt([
            { type: 'input', name: 'username', message: 'Enter LDAP username to add:' },
            { type: 'password', name: 'password', message: 'Enter LDAP password for the user:' },
            { type: 'input', name: 'baseDN', message: 'Enter LDAP Base DN:' }
        ]);

        const spinner = createSpinner(`Adding LDAP user ${username} to Ubuntu...`).start();

        try {
            const ldifContent = `
dn: uid=${username},ou=people,${baseDN}
objectClass: inetOrgPerson
sn: ${username}
cn: ${username}
uid: ${username}
userPassword: ${password}
`;
            const ldifFile = `/tmp/${username}.ldif`;
            fs.writeFileSync(ldifFile, ldifContent);
            execSync(`sudo ldapadd -x -D "cn=admin,${baseDN}" -w admin_password -f ${ldifFile}`);
            spinner.success({ text: `${GREEN(`LDAP user ${username} added to Ubuntu!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to add LDAP user ${username} to Ubuntu!`)}` });
            console.error(error);
        }

        await this.manageLDAP();
    }

    /**
     * Removes an LDAP user from Ubuntu.
     */
    async removeLDAPUserFromUbuntu() {
        const { username, baseDN } = await inquirer.prompt([
            { type: 'input', name: 'username', message: 'Enter LDAP username to remove:' },
            { type: 'input', name: 'baseDN', message: 'Enter LDAP Base DN:' }
        ]);

        const spinner = createSpinner(`Removing LDAP user ${username} from Ubuntu...`).start();

        try {
            execSync(`sudo ldapdelete -x -D "cn=admin,${baseDN}" -w admin_password "uid=${username},ou=people,${baseDN}"`);
            spinner.success({ text: `${GREEN(`LDAP user ${username} removed from Ubuntu!`)}` });
        } catch (error) {
            spinner.error({ text: `${RED(`Failed to remove LDAP user ${username} from Ubuntu!`)}` });
            console.error(error);
        }

        await this.manageLDAP();
    }

    /**
     * Lists all LDAP users in Ubuntu.
     */
    async listLDAPUsers() {
        const { baseDN } = await inquirer.prompt([
            { type: 'input', name: 'baseDN', message: 'Enter LDAP Base DN:' }
        ]);

        const spinner = createSpinner('Fetching LDAP users in Ubuntu...').start();

        try {
            const users = execSync(`ldapsearch -x -LLL -b "ou=people,${baseDN}" uid`).toString();
            spinner.success({ text: `${GREEN('LDAP users fetched successfully!')}` });
            console.log(users);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to fetch LDAP users!')}` });
            console.error(error);
        }

        await this.manageLDAP();
    }

    /**
     * Tests the LDAP connection for Nextcloud.
     */
    async testNextcloudLDAP() {
        const spinner = createSpinner('Testing LDAP connection for Nextcloud...').start();

        try {
            const testResult = execSync(`sudo -u www-data php ${this.occCommand} ldap:test-config s01`).toString();
            spinner.success({ text: `${GREEN('LDAP connection tested successfully for Nextcloud!')}` });
            console.log(testResult);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to test LDAP connection for Nextcloud!')}` });
            console.error(error);
        }

        await this.manageLDAP();
    }
}

// Main entry point
(async () => {
    const ldapManager = new ncLDAP();
    await ldapManager.manageLDAP();
})();
