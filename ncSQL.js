import { RED,BLUE,GRAY,GRAYLI,GREEN,YELLOW,YELLOWLI,PURPLE } from './color.js';
import { clearConsole,welcome } from './utils.js';
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
    constructor() {

        this.backupPath = `/home/${user.trim()}/backups`;
        this.psqlVER = variables.PSQLVER;
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
                    mainMenu();
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
            await this.runCommand(`pg_dump nextcloud_db > ${this.backupPath}/nextcloud_db_backup.sql`);
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
            // Execute restore command
            execSync(`sudo -u postgres psql nextcloud_db < ${this.backupPath}/nextcloud_db_backup.sql`);
            spinner.success({ text: `${GREEN('Database restore completed!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to restore PostgreSQL database')}` });
            console.error(error);
        }
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
            // Check the status of PostgreSQL
            const status = execSync('sudo systemctl status postgresql');
            console.log(GREEN(status.toString()));
            spinner.success({ text: `${GREEN('PostgreSQL status displayed.')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to retrieve PostgreSQL status')}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.managePostgreSQL();
    }
}

export default ncSQL;
