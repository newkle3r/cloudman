
import inquirer from 'inquirer';
import gradient from 'gradient-string';
import chalkAnimation from 'chalk-animation';
import ncUTILS from './ncUTILS.js';
import ncVARS from './ncVARS.js';
import { BLUE, GREEN, YELLOW, RED, PURPLE, GRAY } from './color.js';
import Table from 'cli-table3';
import { execSync } from 'child_process';
import fs from 'fs';
import figlet from 'figlet';


class ncUX {
    constructor() {
        this.util = new ncUTILS();
        this.vars = new ncVARS();
        this.user = this.util.runCommand(`echo $USER`).trim();
        
        

    }
    
    /**
 * Helper function to shorten file paths for display.
 * Converts '/home/username/backups/...' to '~/backups/...'
 * @param {string} fullPath - The full path to shorten.
 * @returns {string} - The shortened path.
 */
shortenPathForDisplay(fullPath) {
    return fullPath.replace(`/home/${this.user}`, '~');
}

/**
 * Gets the number of users from the backup SQL file by parsing its contents.
 * Looks for `COPY` commands for the `oc_users` table.
 * @param {string} backupFile - The path to the backup file.
 * @returns {string} - The number of users found in the backup, or 'N/A' if not found.
 */
getUserCountFromBackup(backupFile) {
    try {
        const backupContent = fs.readFileSync(backupFile, { encoding: 'utf8' });
        const copySection = backupContent.match(/COPY public\.oc_users.*FROM stdin;\n([\s\S]*?)\\\./);

        if (copySection) {
            const userData = copySection[1].trim();
            const userLines = userData.split('\n').filter(line => line.trim() !== '');
            return userLines.length.toString();
        }
        return '0';
    } catch (error) {
        return 'N/A';
    }
}

/**
 * Displays an overview of PostgreSQL backups, users, and status.
 * Shows backup file status, path, size, time, and user count.
 */
async displayPostgresInfo() {
    this.util.clearConsole();
    const linkText = 'Do you want a professional to migrate or update your database? Click here!';
    const url = 'https://shop.hanssonit.se/product-category/support/';
    console.log(`\x1B]8;;${url}\x07${PURPLE(linkText)}\x1B]8;;\x07`);

    const table = new Table({
        colWidths: [40, 40],
    });

    const backupPath = `/home/${this.user}/backups/nextcloud_db_backup.sql`;
    let backupExists = false;
    let backupSize = 'N/A';
    let backupTime = 'N/A';

    if (fs.existsSync(backupPath)) {
        backupExists = true;
        backupSize = (fs.statSync(backupPath).size / (1024 * 1024)).toFixed(2) + ' MB';
        backupTime = execSync(`stat -c %y ${backupPath}`).toString().trim();
    }

    let nextcloudUserCount = 'N/A';
    let backupUserCount = 'N/A';
    try {
        const userCountQuery = `SELECT COUNT(*) FROM oc_users;`;
        nextcloudUserCount = execSync(`sudo -u postgres psql -t -d nextcloud_db -c "${userCountQuery}"`, { stdio: 'pipe' }).toString().trim();

        if (backupExists) {
            backupUserCount = this.getUserCountFromBackup(backupPath);
        }
    } catch (error) {
        nextcloudUserCount = 'N/A';
    }

    table.push(
        [`${BLUE('Backup file exists:')}`, backupExists ? GREEN('Yes') : RED('No')],
        [`${BLUE('Backup path:')}`, backupExists ? GREEN(this.shortenPathForDisplay(backupPath)) : RED('N/A')],
        [`${BLUE('Backup size:')}`, backupExists ? GREEN(backupSize) : RED('N/A')],
        [`${BLUE('Backup created on:')}`, backupExists ? GREEN(backupTime) : RED('N/A')],
        [`${BLUE('Users in nextcloud_db:')}`, YELLOW(nextcloudUserCount)],
        [`${BLUE('Users in backup file:')}`, YELLOW(backupUserCount)]
    );

    console.log(table.toString());
}



    /**
     * Displays a splash welcome screen with system information.
     */
    async welcome() {
        const linkText = 'Want a professional to just fix it for you? Click here!';
        const url = 'https://shop.hanssonit.se/product-category/support/';
        // this.util.clearConsole(); //temp disable
        console.log(`\x1B]8;;${url}\x07${PURPLE(linkText)}\x1B]8;;\x07`);

        const rainbowTitle = chalkAnimation.rainbow(
            'Nextcloud instance manager by T&M Hansson IT \n'
        );
        
        await new Promise((resolve) => setTimeout(resolve, 1000));
        rainbowTitle.stop();

        console.log(
            gradient.pastel.multiline(
                figlet.textSync('Cloudman', { horizontalLayout: 'full' })
            )
        );
    }

}
export default ncUX;