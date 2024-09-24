import { RED,BLUE,GRAY,GRAYLI,GREEN,YELLOW,YELLOWLI,PURPLE } from './color.js';
import { clearConsole,runCommand,welcome,getConfigValue } from './utils.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';

const variablesPath = 'variables.json';
    let variables = {};

    if (fs.existsSync(variablesPath)) {
        variables = JSON.parse(fs.readFileSync(variablesPath, 'utf8'));
    }


/**
 * Class for managing PostgreSQL-related tasks such as backup, restore, and status check.
 */
class ncSQL {
    constructor(mainMenu) {
        this.mainMenu = mainMenu;
        this.runCommand = runCommand;
        const user = this.runCommand(`echo $USER`).trim();
        
        this.backupPath = `/home/${user}/backups`;
        this.psqlVER = variables.PSQLVER;

        const configFilePath = '/var/www/nextcloud/config/config.php';
        const configFile = execSync(`sudo -u www-data cat ${configFilePath}`, { encoding: 'utf8' });
        this.dbname = getConfigValue(configFile, 'dbname');
        this.dbuser = getConfigValue(configFile, 'dbuser');
        this.dbpassword = getConfigValue(configFile, 'dbpassword');
    }

    /**
     * Displays the menu for PostgreSQL management tasks.
     */
    async managePostgreSQL(mainMenu) {

        let continueMenu = true;
        clearConsole();
        while (continueMenu === true) {
            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'PostgreSQL management:',
                    choices: [
                        'Backup Database',
                        'Restore Database',
                        'View Database Status',
                        'Go Back'
                    ],
                }
            ]);

            switch (answers.action) {
                case 'Backup Database':
                    this.backupDatabase();
                    break;
                case 'Restore Database':
                    this.restoreDatabase();
                    break;
                case 'View Database Status':
                    this.viewDatabaseStatus();
                    break;
                case 'Go Back':
                    continueMenu = false;
                    this.mainMenu();
                    break;
                    
            }
        }
    }

    /**
     * Backs up the PostgreSQL database to the specified location.
     * The backup is saved as a single file using pg_dump.
     */
    async backupDatabase() {
        clearConsole();
        const spinner = createSpinner('Backing up PostgreSQL database...').start();

        try {
            // Step 1: Fetch the current user asynchronously
            const user = await this.runCommand('echo $USER');

            // Step 2: Set the backup path
            this.backupPath = `/home/${user.trim()}/backups`;

            // Step 3: Ensure the directory exists
            await this.runCommand(`mkdir -p ${this.backupPath}`);

            // Step 4: Create PostgreSQL backup
            console.log(BLUE(`Creating PostgreSQL backup in ${this.backupPath}...`));
            await this.runCommand(`sudo -u postgres pg_dump nextcloud_db > ${this.backupPath}/nextcloud_db_backup.sql`);
            spinner.success({ text: `${GREEN('Database backup completed!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to backup PostgreSQL database')}` });
            console.error(error);
        }

        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.managePostgreSQL();
    }

    /**
     * Restores the PostgreSQL database from the backup file.
     */
    async restoreDatabase() {
        clearConsole();
        const spinner = createSpinner('Restoring PostgreSQL database...').start();
        
        try {
            // Ensure the PostgreSQL role exists
            execSync(`sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${this.dbuser}'" | grep -q 1 || sudo -u postgres psql -c "CREATE ROLE ${this.dbuser} WITH LOGIN PASSWORD '${this.dbpassword}';"`);
    
            // Drop the existing database if it exists
            execSync(`sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${this.dbname};"`);
            
            // Recreate the database with the correct owner
            execSync(`sudo -u postgres psql -c "CREATE DATABASE ${this.dbname} OWNER ${this.dbuser};"`);
    
            // Restore the database from the backup file
            execSync(`sudo -u postgres psql ${this.dbname} < ${this.backupPath}/nextcloud_db_backup.sql`);
    
            spinner.success({ text: `${GREEN('Database restore completed!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to restore PostgreSQL database')}` });
            console.error(error);
        }
    
        // Wait for user input before continuing
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.managePostgreSQL();
    }
    
    /**
     * Displays the status of the PostgreSQL service.
     */
    async viewDatabaseStatus() {
        clearConsole();
        const spinner = createSpinner('Checking PostgreSQL status...').start();
        
        try {
            // Check the status of PostgreSQL and capture the output
            const status = execSync('sudo systemctl status postgresql', { stdio: 'pipe' }).toString();
            
            // Mark the spinner as successful and display the status
            spinner.success({ text: `${GREEN('PostgreSQL status displayed.')}` });
            console.log(GREEN(status));
    
            // Wait for user input before continuing
            await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        } catch (error) {
            spinner.error({ text: `${RED('Failed to retrieve PostgreSQL status')}` });
            console.error(RED(error.message));
    
            // Wait for user input before continuing in case of error
            await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        }
    }
    
}

export default ncSQL;
