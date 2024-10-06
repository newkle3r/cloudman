import ncUTILS from './ncUTILS.js';
import { RED, BLUE, GRAY, GRAYLI, GREEN, YELLOW, YELLOWLI, PURPLE } from './color.js';
import { spawnSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createSpinner } from 'nanospinner';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ncVARS from './ncVARS.js';

// Menu needs clear function and suitable splash

function getTimestamp() {
    return new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
}







// Backup class
class ncBAK {
    constructor(mainMenu) {
        this.util = new ncUTILS();
        const lib = new ncVARS();
        const { NCDB, NCDBUSER, NCDBPASS, NCDBHOST} = lib.ncdb();
        this.NCDB = NCDB;
        this.NCDBUSER = NCDBUSER;
        this.NCDBPASS = NCDBPASS;
        this.NCDBHOST = NCDBHOST;
        this.mainMenu = mainMenu;

        // Set paths based on Nextcloud installation path
        this.ncDataDir = lib.NCPATH || '/var/www/nextcloud';  // Default to /var/www/nextcloud
        this.ncConfDir = `${this.ncDataDir}/config`;
        this.backupDir = `/home/${lib.UNIXUSER}/backups`; 
        this.timestamp = getTimestamp();
        this.psqlBakFile = path.join(this.backupDir, `postgresql_backup.sql`);

        // Database configuration
   
        this.psqlDbName = NCDB;
        this.psqlUser = NCDBUSER;
        this.psqlPass = NCDBPASS;
        this.psqlHost = NCDBHOST;

        // Other service configuration paths
        this.apacheConfDir = '/etc/apache2'; 
        this.redisConfDir = '/etc/redis'; 
        this.phpConfigDir = '/etc/php'; 

        
    }
    formatBackupTimestamp(backupTimestamp) {
        if (!backupTimestamp || !/^\d{8}T\d{6}$/.test(backupTimestamp)) {
            return "Invalid timestamp";  
        }

        const year = backupTimestamp.slice(0, 4);
        const month = backupTimestamp.slice(4, 6);
        const day = backupTimestamp.slice(6, 8);
        const hour = backupTimestamp.slice(9, 11);
        const minute = backupTimestamp.slice(11, 13);
        const second = backupTimestamp.slice(13, 15);
    
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    

        const dayWithSuffix = (day) => {
            const j = day % 10, k = day % 100;
            if (j == 1 && k != 11) return `${day}st`;
            if (j == 2 && k != 12) return `${day}nd`;
            if (j == 3 && k != 13) return `${day}rd`;
            return `${day}th`;
        };

        const monthName = monthNames[parseInt(month, 10) - 1];

        const greenText = GREEN(`${dayWithSuffix(parseInt(day, 10))} ${monthName}`);
        const purpleTimeYear = PURPLE(`${hour}:${minute}:${second} | ${year}`);
        const yellowBrackets = YELLOW(`{ `) + purpleTimeYear + YELLOW(` }`);

        return `\n${greenText}${yellowBrackets}`;
    }


    ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            console.log(chalk.yellow('Creating backup directory...'));
            const result = spawnSync('sudo', ['mkdir', '-p', this.backupDir]);
    
            if (result.error) {
                console.error(chalk.red('Failed to create backup directory.'));
             
                return false;
            } else {
                console.log(chalk.green(`Created backup directory at ${this.backupDir}`));
            }
        }
        return true;
    }

    // PostgreSQL backup  
    backupPostgreSQL() {

        const spinner = createSpinner('Backing up PostgreSQL database...').start();
        try {
            this.util.runCommand(`sudo -u postgres pg_dump ${this.NCDBUSER} > ${this.psqlBakFile}`);
            spinner.success({ text: chalk.green('PostgreSQL backup completed successfully!') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to backup PostgreSQL!') });
            console.error(error);
        }
    }

    // Nextcloud data backup  
    backupNextcloud() {
        const spinner = createSpinner('Backing up Nextcloud data and configuration...').start();
        try {
            const nextcloudBackupFile = path.join(this.backupDir, `nextcloud_backup_${this.timestamp}.tar.gz`);
            execSync(`sudo tar -czf ${nextcloudBackupFile} ${this.ncDataDir}`);
            spinner.success({ text: chalk.green('Nextcloud data and config backup completed successfully!') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to backup Nextcloud data and config!') });
            console.error(error);
        }
    }

    // Backup Redis configuration  
    backupRedis() {
        const spinner = createSpinner('Backing up Redis configuration...').start();
        try {
            const redisBackupFile = path.join(this.backupDir, `redis_backup_${this.timestamp}.tar.gz`);
            execSync(`sudo tar -czf ${redisBackupFile} ${this.redisConfDir}`);
            spinner.success({ text: chalk.green('Redis configuration backup completed successfully!') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to backup Redis configuration!') });
            console.error(error);
        }
    }

    // Apache configuration backup  
    backupApache() {
        const spinner = createSpinner('Backing up Apache configuration...').start();
        try {
            const apacheBackupFile = path.join(this.backupDir, `apache_backup_${this.timestamp}.tar.gz`);
            execSync(`sudo tar -czf ${apacheBackupFile} ${this.apacheConfDir}`);
            spinner.success({ text: chalk.green('Apache configuration backup completed successfully!') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to backup Apache configuration!') });
            console.error(error);
        }
    }

    // PHP configuration backup  
    backupPHP() {
        const spinner = createSpinner('Backing up PHP configuration...').start();
        try {
            const phpBackupFile = path.join(this.backupDir, `php_backup_${this.timestamp}.tar.gz`);
            execSync(`sudo tar -czf ${phpBackupFile} ${this.phpConfigDir}`);
            spinner.success({ text: chalk.green('PHP configuration backup completed successfully!') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to backup PHP configuration!') });
            console.error(error);
        }
    }

    // Run backups
    async runBackups() {
        let continueMenu = true;
        this.util.clearConsole();
        
    
        while (continueMenu) {
            const choices = [
                { name: 'Backup PostgreSQL', value: 'backupPostgres' },
                { name: 'Backup Nextcloud', value: 'backupNextcloud' },
                { name: 'Backup Redis', value: 'backupRedis' },
                { name: 'Backup Apache', value: 'backupApache' },
                { name: 'Backup PHP', value: 'backupPHP' },
                { name: 'Restore PostgreSQL', value: 'restorePostgres' },
                { name: 'Restore Nextcloud', value: 'restoreNextcloud' },
                { name: 'Restore Redis', value: 'restoreRedis' },
                { name: 'Restore Apache', value: 'restoreApache' },
                { name: 'Restore PHP', value: 'restorePHP' },
                { name: 'Go Back', value: 'goBack' }
            ];
    
            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'backupOption',
                    message: 'Select the components you want to backup or restore:',
                    choices
                }
            ]);
    
            console.log(chalk.blue('Starting the selected task...'));
            this.ensureBackupDir();
    
            switch (answers.backupOption) {
                case 'backupPostgres':
                    await this.backupPostgreSQL();
                    break;
                case 'backupNextcloud':
                    await this.backupNextcloud();
                    break;
                case 'backupRedis':
                    await this.backupRedis();
                    break;
                case 'backupApache':
                    await this.backupApache();
                    break;
                case 'backupPHP':
                    await this.backupPHP();
                    break;
                case 'restorePostgres':
                    await this.restorePostgreSQL();
                    break;
                case 'restoreNextcloud':
                    await this.restoreNextcloud();
                    break;
                case 'restoreRedis':
                    await this.restoreRedis();
                    break;
                case 'restoreApache':
                    await this.restoreApache();
                    break;
                case 'restorePHP':
                    await this.restorePHP();
                    break;
                case 'goBack':
                    continueMenu = false; 
                    this.mainMenu();
                    break;
            }
    
            console.log(chalk.green('Task completed!'));  // Confirm task completion
        }
    }


// Restore PostgreSQL database
restorePostgreSQL() {

    const backupFile = `/mnt/backups/postgresql_backup.sql`;
    const spinner = createSpinner('Restoring PostgreSQL database...').start();

    if (!fs.existsSync(backupFile)) {
        spinner.error({ text: chalk.red(`Backup file ${backupFile} not found!`) });
        return;
    }

    try {
        execSync(`sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${this.psqlDbName};"`);
        execSync(`sudo -u postgres psql -c "CREATE DATABASE ${this.psqlDbName} OWNER ${this.psqlUser};")`);
        execSync(`sudo -u postgres psql ${this.psqlDbName} < ${backupFile}`);
        spinner.success({ text: chalk.green('PostgreSQL database restored successfully!') });
    } catch (error) {
        spinner.error({ text: chalk.red('Failed to restore PostgreSQL database!') });
        console.error(error);
    }
}

// Restore Nextcloud data and configuration
restoreNextcloud() {
    const backupFile = `/mnt/backups/nextcloud_backup.tar.gz`;  // Path to the backup file
    const spinner = createSpinner('Restoring Nextcloud data and configuration...').start();

    try {
        execSync(`sudo tar -xzf ${backupFile} -C /var/www/nextcloud`);
        spinner.success({ text: chalk.green('Nextcloud data and config restored successfully!') });
    } catch (error) {
        spinner.error({ text: chalk.red('Failed to restore Nextcloud data and config!') });
        console.error(error);
    }
}
// Restore Redis configuration
restoreRedis() {
    const backupFile = `/mnt/backups/redis_backup.tar.gz`;  // Path to the backup file
    const spinner = createSpinner('Restoring Redis configuration...').start();

    try {
        execSync(`sudo tar -xzf ${backupFile} -C /etc/redis`);
        spinner.success({ text: chalk.green('Redis configuration restored successfully!') });
    } catch (error) {
        spinner.error({ text: chalk.red('Failed to restore Redis configuration!') });
        console.error(error);
    }
}
// Restore Apache configuration
restoreApache() {
    const backupFile = `/mnt/backups/apache_backup.tar.gz`;  // Path to the backup file
    const spinner = createSpinner('Restoring Apache configuration...').start();

    try {
        execSync(`sudo tar -xzf ${backupFile} -C /etc/apache2`);
        spinner.success({ text: chalk.green('Apache configuration restored successfully!') });
    } catch (error) {
        spinner.error({ text: chalk.red('Failed to restore Apache configuration!') });
        console.error(error);
    }
}
// Restore PHP configuration
restorePHP() {
    const backupFile = `/mnt/backups/php_backup.tar.gz`;  // Path to the backup file
    const spinner = createSpinner('Restoring PHP configuration...').start();

    try {
        execSync(`sudo tar -xzf ${backupFile} -C /etc/php`);
        spinner.success({ text: chalk.green('PHP configuration restored successfully!') });
    } catch (error) {
        spinner.error({ text: chalk.red('Failed to restore PHP configuration!') });
        console.error(error);
    }
}
}

export default ncBAK;
