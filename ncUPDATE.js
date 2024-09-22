import { RED,GREEN } from './color.js';
import { execSync } from 'child_process';
import fs from 'fs';
import readlineSync from 'readline-sync';
import inquirer from 'inquirer';


/**
 * Class to handle the Nextcloud update process.
 * This script provides an option to run a full update or perform individual steps.
 * 
 * @class ncUPDATE
 */
class ncUPDATE {
  constructor() {
    this.SCRIPTS = '/var/scripts';
    this.BACKUP = '/mnt/NCBACKUP/';
    this.NCPATH = '/var/www/nextcloud';
    this.VMLOGS = '/var/log/nextcloud-vm';
    this.CURRENTVERSION = this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ status | grep "versionstring" | awk '{print $3}'`);
    this.DISTRO = this.runCommand('lsb_release -sr');
  }

  /**
   * Executes a shell command and returns the output as a string.
   * @param {string} command - The command to execute.
   * @returns {string} - The command's output as a string.
   */
  runCommand(command) {
    try {
      return execSync(command).toString().trim();
    } catch (error) {
      console.error(`Error executing command: ${command}`, error);
      return '';
    }
  }

  /**
   * Displays a menu for managing the Nextcloud update process.
   * Follows the same format as ncPHP for consistency in user interface.
   * 
   * @param {Function} mainMenu - The main menu function from `index.js` to return back.
   * @returns {Promise<void>} - Resolves when the user action is completed.
   */
  async manageUpdate(mainMenu) {

      let continueMenu = true;

      while (continueMenu ===true) {

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Nextcloud Update Management:',
        choices: [
          'Run Full Update',
          'Enable Maintenance Mode',
          'Check Free Space',
          'Create Backup',
          'Download Nextcloud',
          'Extract Nextcloud',
          'Run Nextcloud Upgrade',
          'Cleanup',
          'Disable Maintenance Mode',
          'Exit'
        ],
      }
    ]);

    switch (answers.action) {
      case 'Run Full Update':
        this.runFullUpdate();
        break;
      case 'Enable Maintenance Mode':
        this.enableMaintenanceMode();
        break;
      case 'Check Free Space':
        this.checkFreeSpace();
        break;
      case 'Create Backup':
        this.createBackup();
        break;
      case 'Download Nextcloud':
        this.downloadNextcloud();
        break;
      case 'Extract Nextcloud':
        this.extractNextcloud();
        break;
      case 'Run Nextcloud Upgrade':
        this.upgradeNextcloud();
        break;
      case 'Cleanup':
        this.cleanup();
        break;
      case 'Disable Maintenance Mode':
        this.disableMaintenanceMode();
        break;
      case 'Exit':
        console.log(chalk.yellow('Returning to main menu...'));
        continueMenu = false;
        mainMenu();
        break;
    }
  }
}



  /**
   * Checks if apt or dpkg processes are running.
   * Exits if found.
   */
  checkProcesses() {
    const aptRunning = this.runCommand('pgrep apt');
    const dpkgRunning = this.runCommand('pgrep dpkg');
    if (aptRunning || dpkgRunning) {
      console.error('Apt or Dpkg processes are currently running. Please wait for them to finish.');
      process.exit(1);
    }
  }

  /**
   * Enables maintenance mode in Nextcloud.
   */
  enableMaintenanceMode() {
    this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --on`);
    console.log('Maintenance mode enabled.');
  }

  /**
   * Disables maintenance mode in Nextcloud.
   */
  disableMaintenanceMode() {
    this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --off`);
    console.log('Maintenance mode disabled.');
  }

  /**
   * Checks if the server has enough free disk space for the update.
   */
  checkFreeSpace() {
    const freeSpace = this.runCommand("df -h | grep -m 1 '/' | awk '{print $4}'");
    if (parseInt(freeSpace) < 50) {
      console.error('Not enough disk space for backup. At least 50GB required.');
      process.exit(1);
    }
    console.log('Sufficient free space for backup.');
  }

  /**
   * Creates a backup of Nextcloud's config and apps directories.
   */
  createBackup() {
    if (!fs.existsSync(this.BACKUP)) {
      fs.mkdirSync(this.BACKUP, { recursive: true });
    }
    console.log('Creating a backup of Nextcloud files...');
    this.runCommand(`rsync -Aax ${this.NCPATH}/config ${this.BACKUP}`);
    this.runCommand(`rsync -Aax ${this.NCPATH}/apps ${this.BACKUP}`);
    console.log('Backup completed.');
  }

  /**
   * Downloads the latest Nextcloud release.
   */
  downloadNextcloud() {
    console.log('Downloading the latest Nextcloud release...');
    this.runCommand('curl -o nextcloud-latest.zip https://download.nextcloud.com/server/releases/latest.zip');
    console.log('Nextcloud package downloaded.');
  }

  /**
   * Extracts the downloaded Nextcloud package into the web directory.
   */
  extractNextcloud() {
    console.log('Extracting Nextcloud package...');
    this.runCommand('unzip nextcloud-latest.zip -d /var/www');
    console.log('Extraction completed.');
  }

  /**
   * Runs the Nextcloud upgrade using the OCC command.
   */
  upgradeNextcloud() {
    console.log('Running Nextcloud upgrade...');
    this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ upgrade`);
    console.log('Nextcloud upgrade completed.');
  }

  /**
   * Cleans up downloaded files and temporary files.
   */
  cleanup() {
    console.log('Cleaning up...');
    fs.unlinkSync('nextcloud-latest.zip');
    console.log('Cleanup completed.');
  }

  /**
   * Runs the full Nextcloud update process.
   */
  runFullUpdate() {
    this.isRoot();
    this.checkProcesses();
    this.checkFreeSpace();
    this.enableMaintenanceMode();
    this.createBackup();
    this.downloadNextcloud();
    this.extractNextcloud();
    this.upgradeNextcloud();
    this.cleanup();
    this.disableMaintenanceMode();
    console.log('Nextcloud update completed successfully.');
  }
}


export default ncUPDATE;