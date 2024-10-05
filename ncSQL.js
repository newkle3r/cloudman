import { RED,BLUE,GRAY,GRAYLI,GREEN,YELLOW,YELLOWLI,PURPLE } from './color.js';
import ncUTILS from './ncUTILS.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';
import fs from 'fs';
import ncUX from './ncUX.js';
import ncVARS from './ncVARS.js';

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
        this.util = new ncUTILS();
        this.getConfigValue = this.getConfigValue; 
        this.clearConsole = this.util.clearConsole;
        this.mainMenu = mainMenu;
        this.runCommand = this.util.runCommand;
        const user = this.runCommand(`echo $USER`).trim();
        
        this.backupPath = `/home/${user}/backups`;
        this.psqlVER = variables.PSQLVER;

        try {
            const configFilePath = '/var/www/nextcloud/config/config.php';
            const configFileContent = execSync(`sudo cat ${configFilePath}`, { encoding: 'utf8' });
            
            this.dbname = this.getConfigValue(configFileContent, 'dbname');
            this.dbuser = this.getConfigValue(configFileContent, 'dbuser');
            this.dbpassword = this.getConfigValue(configFileContent, 'dbpassword');
            
            // Check if values were successfully retrieved
            if (!this.dbname || !this.dbuser || !this.dbpassword) {
                console.error(`Error: Missing values in config.php. dbname: ${this.dbname}, dbuser: ${this.dbuser}, dbpassword: ${this.dbpassword}`);
            }
        } catch (error) {
            console.error(`Error reading config.php file: ${error.message}`);
        }
    }

    /**
     * Extracts a configuration value from the Nextcloud config.php file content.
     * @param {string} configContent - The content of the config.php file.
     * @param {string} key - The key to extract (e.g., 'dbname', 'dbuser', 'dbpassword').
     * @returns {string|null} - The extracted value or null if not found.
     */
    getConfigValue(configContent, key) {
        const regex = new RegExp(`'${key}'\\s*=>\\s*'(.*?)'`, 'i');
        const match = configContent.match(regex);
        return match ? match[1] : null;
    }

    /**
     * Displays the menu for PostgreSQL management tasks.
     */
    async managePostgreSQL() {
        let disp = new ncUX();
        this.clearConsole();
        disp.displayPostgresInfo();
        let continueMenu = true;
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
                    return this.mainMenu();
            }
        }
    }

    /**
     * Backs up the PostgreSQL database to the specified location.
     */
    async backupDatabase() {
        this.clearConsole();
        const spinner = createSpinner('Backing up PostgreSQL database...').start();

        try {
            const user = await this.runCommand('echo $USER');
            this.backupPath = `/home/${user.trim()}/backups`;
            await this.runCommand(`mkdir -p ${this.backupPath}`);

            console.log(BLUE(`Creating PostgreSQL backup in ${this.backupPath}...`));
            await this.runCommand(`sudo -u postgres pg_dump ${this.dbname} > ${this.backupPath}/nextcloud_db_backup.sql`);
            spinner.success({ text: `${GREEN('Database backup completed!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to backup PostgreSQL database')}` });
            console.error(error);
        }

        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.managePostgreSQL();
    }

    /**
 * Restores the PostgreSQL database from a backup file.
 * Provides real-time feedback about the restoration steps being performed.
 */
async restoreDatabase() {
    this.clearConsole();
    const spinner = createSpinner('Restoring PostgreSQL database...').start();

    try {
        // Step 1: Check if the database role (user) exists and create it if it doesn't
        console.log(`Checking if the PostgreSQL role '${this.dbuser}' exists...`);
        const roleExistsCommand = `sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${this.dbuser}'" | grep -q 1`;
        const createRoleCommand = `sudo -u postgres psql -c "CREATE ROLE ${this.dbuser} WITH LOGIN PASSWORD '${this.dbpassword}';"`;

        execSync(`${roleExistsCommand} || ${createRoleCommand}`);
        console.log(`${GREEN(`PostgreSQL role '${this.dbuser}' is now ready.`)}`);

        // Step 2: Drop the existing database (if it exists) and create a new one
        console.log(`Dropping the existing database '${this.dbname}' (if it exists)...`);
        execSync(`sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${this.dbname};"`);
        console.log(`${YELLOW(`Existing database '${this.dbname}' dropped (if present).`)}`);

        console.log(`Creating a new database '${this.dbname}' owned by '${this.dbuser}'...`);
        execSync(`sudo -u postgres psql -c "CREATE DATABASE ${this.dbname} OWNER ${this.dbuser};"`);
        console.log(`${GREEN(`New database '${this.dbname}' created.`)}`);

        // Step 3: Restore the database from the backup file
        const backupFilePath = `${this.backupPath}/nextcloud_db_backup.sql`;
        console.log(`Restoring the database from the backup file located at: ${backupFilePath}`);
        execSync(`sudo -u postgres psql ${this.dbname} < ${backupFilePath}`);
        console.log(`${GREEN(`Database restored from backup file.`)}`);

        // Success spinner
        spinner.success({ text: `${GREEN('Database restore completed successfully!')}` });
    } catch (error) {
        // Error spinner and message
        spinner.error({ text: `${RED('Failed to restore PostgreSQL database')}` });
        console.error(`${RED('Error details:')} ${error.message}`);
    }

    // Pause before returning to the main menu
    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    await this.managePostgreSQL();
}


    /**
 * Displays the status of the PostgreSQL service, including:
 * - The list of available databases
 * - The number of users in the PostgreSQL server
 * - The last modification time of each database
 */
async viewDatabaseStatus() {
    this.clearConsole();
    const spinner = createSpinner('Checking PostgreSQL status...').start();

    try {
        // Step 1: Check PostgreSQL service status
        const status = execSync('sudo systemctl status postgresql', { stdio: 'pipe' }).toString();
        console.log(GREEN('PostgreSQL service status:\n'));
        console.log(GREEN(status));

        // Step 2: List available databases
        console.log(YELLOW('Fetching available databases...'));
        const databases = execSync(`sudo -u postgres psql -c "\\l"`, { stdio: 'pipe' }).toString();
        console.log(GREEN('Available Databases:\n'));
        console.log(GREEN(databases));

        // Step 3: Count the number of users in the database
        console.log(YELLOW('Counting the number of users in the PostgreSQL server...'));
        const userCountQuery = `SELECT COUNT(*) FROM pg_roles WHERE rolcanlogin;`;
        const userCount = execSync(`sudo -u postgres psql -t -c "${userCountQuery}"`, { stdio: 'pipe' }).toString().trim();
        console.log(GREEN(`Number of users in the PostgreSQL server: ${userCount}`));

        // Step 4: Get the correct PostgreSQL data directory path
        const dataDir = execSync(`sudo -u postgres psql -t -c "SHOW data_directory;"`, { stdio: 'pipe' }).toString().trim();
        if (!dataDir) throw new Error('Failed to fetch PostgreSQL data directory.');

        // Step 5: Get the last modified date of each database by checking the correct file system path
        console.log(YELLOW('Fetching the last modification time of the databases...'));
        const dbDirectories = execSync(`sudo -u postgres psql -t -c "SELECT oid, datname FROM pg_database WHERE datname NOT IN ('template0', 'template1', 'postgres');"`, { stdio: 'pipe' }).toString().trim();
        
        const dbList = dbDirectories.split('\n').map(line => {
            const [oid, datname] = line.trim().split('|').map(item => item.trim());
            return { oid, datname };
        });

        dbList.forEach(db => {
            if (db.oid) {
                const modTime = execSync(`sudo stat -c '%y' ${dataDir}/base/${db.oid}`).toString().trim();
                console.log(GREEN(`Database: ${db.datname}, Last modified: ${modTime}`));
            }
        });

        // Stop the spinner with success
        spinner.success({ text: `${GREEN('PostgreSQL status and database details displayed.')}` });

        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    } catch (error) {
        // Handle errors and stop the spinner with failure
        spinner.error({ text: `${RED('Failed to retrieve PostgreSQL status or details')}` });
        console.error(RED(error.message));

        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    }
}

}

export default ncSQL;
