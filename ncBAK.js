import { RED, BLUE, GRAY, GRAYLI, GREEN, YELLOW, YELLOWLI, PURPLE } from './color.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createSpinner } from 'nanospinner';
import chalk from 'chalk';
import inquirer from 'inquirer';

// Helper function to create a timestamp for backup files
function getTimestamp() {
    return new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
}

// Backup class
class ncBAK {
    constructor() {
        this.backupDir = '/mnt/backups'; // Backup directory path
        this.timestamp = getTimestamp();
        this.postgresBackupFile = path.join(this.backupDir, `psql_backup_${this.timestamp}.sql`);
        this.nextcloudDataDir = '/var/www/nextcloud'; // Nextcloud installation directory
        this.nextcloudConfigDir = '/var/www/nextcloud/config'; // Nextcloud config files
        this.apacheConfigDir = '/etc/apache2'; // Apache config directory
        this.redisConfigDir = '/etc/redis'; // Redis config directory
        this.phpConfigDir = '/etc/php'; // PHP config directory
    }

    // Ensure backup directory exists
    ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            console.log(chalk.green(`Created backup directory at ${this.backupDir}`));
        }
    }

    // PostgreSQL backup
    backupPostgreSQL() {
        const spinner = createSpinner('Backing up PostgreSQL database...').start();
        try {
            execSync(`pg_dumpall -U postgres > ${this.postgresBackupFile}`);
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
            execSync(`tar -czf ${nextcloudBackupFile} ${this.nextcloudDataDir}`);
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
            execSync(`tar -czf ${redisBackupFile} ${this.redisConfigDir}`);
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
            execSync(`tar -czf ${apacheBackupFile} ${this.apacheConfigDir}`);
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
            execSync(`tar -czf ${phpBackupFile} ${this.phpConfigDir}`);
            spinner.success({ text: chalk.green('PHP configuration backup completed successfully!') });
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to backup PHP configuration!') });
            console.error(error);
        }
    }

    // Run backups
    async runBackups() {
        const choices = [
            { name: 'Backup PostgreSQL', value: 'postgres' },
            { name: 'Backup Nextcloud', value: 'nextcloud' },
            { name: 'Backup Redis', value: 'redis' },
            { name: 'Backup Apache', value: 'apache' },
            { name: 'Backup PHP', value: 'php' },
        ];

        const answers = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'backupOptions',
                message: 'Select the components you want to backup:',
                choices
            }
        ]);

        console.log(chalk.blue('Starting the selected backups...'));
        this.ensureBackupDir();

        if (answers.backupOptions.includes('postgres')) {
            this.backupPostgreSQL();
        }
        if (answers.backupOptions.includes('nextcloud')) {
            this.backupNextcloud();
        }
        if (answers.backupOptions.includes('redis')) {
            this.backupRedis();
        }
        if (answers.backupOptions.includes('apache')) {
            this.backupApache();
        }
        if (answers.backupOptions.includes('php')) {
            this.backupPHP();
        }

        console.log(chalk.green('Selected backups completed!'));
    }
}
/*
// Main entry point
(async () => {
    const ncBAK = new ncBAK();
    await ncBAK.runBackups();
})();
*/
export default ncBAK;
