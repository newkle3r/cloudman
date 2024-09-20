import { RED,BLUE,GRAY,GRAYLI,GREEN,YELLOW,YELLOWLI,PURPLE } from './color.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';
import chalk from 'chalk';


/**
 * Class for managing PostgreSQL-related tasks such as backup, restore, and status check.
 */
class ncSQL {
    constructor() {
        // Add any necessary initialization if needed, e.g., paths or configurations
        this.backupPath = '/var/backups/postgresql_backup.sql'; // Default backup location
    }

    /**
     * Displays the menu for PostgreSQL management tasks.
     */
    async managePostgreSQL() {
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
                return this.backupDatabase();
            case 'Restore Database':
                return this.restoreDatabase();
            case 'View Database Status':
                return this.viewDatabaseStatus();
            case 'Go Back':
                return;  // Or call another function to navigate to the main menu
        }
    }

    /**
     * Backs up the PostgreSQL database to the specified location.
     * The backup is saved as a single file using pg_dumpall.
     */
    async backupDatabase() {
        const spinner = createSpinner('Backing up PostgreSQL database...').start();
        
        try {
            // Execute backup command
            execSync(`sudo -u postgres pg_dumpall > ${this.backupPath}`);
            spinner.success({ text: `${GREEN('Database backup completed!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to backup PostgreSQL database')}` });
            console.error(error);
        }

        await this.managePostgreSQL();
    }

    /**
     * Restores the PostgreSQL database from the backup file.
     */
    async restoreDatabase() {
        const spinner = createSpinner('Restoring PostgreSQL database...').start();
        
        try {
            // Execute restore command
            execSync(`sudo -u postgres psql < ${this.backupPath}`);
            spinner.success({ text: `${GREEN('Database restore completed!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to restore PostgreSQL database')}` });
            console.error(error);
        }

        await this.managePostgreSQL();
    }

    /**
     * Displays the status of the PostgreSQL service.
     */
    async viewDatabaseStatus() {
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

        await this.managePostgreSQL();
    }
}

export default ncSQL;
