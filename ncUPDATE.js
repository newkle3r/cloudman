import { execSync } from 'child_process';
import fs from 'fs';
import readlineSync from 'readline-sync';

/**
 * Class to handle the Nextcloud update process.
 * This script provides an option to run a full update or perform individual steps.
 */
class ncUpdate {
  constructor() {
    this.SCRIPTS = '/var/scripts';
    this.BACKUP = '/mnt/NCBACKUP/';
    this.NCPATH = '/var/www/nextcloud';
    this.VMLOGS = '/var/log/nextcloud-vm';
    this.CURRENTVERSION = this.getCommandOutput(`sudo -u www-data php ${this.NCPATH}/occ status | grep "versionstring" | awk '{print $3}'`);
    this.DISTRO = this.getCommandOutput('lsb_release -sr');
  }

  /**
   * Executes a shell command and returns the output as a string.
   * @param {string} command - The command to be executed.
   * @returns {string} - The output of the command execution.
   */
  getCommandOutput(command) {
    try {
      return execSync(command).toString().trim();
    } catch (error) {
      console.error(`Error executing command: ${command}`, error);
      return '';
    }
  }

  /**
   * Checks if the script is running as root.
   * If the user is not root, the script will exit.
   */
  isRoot() {
    const user = this.getCommandOutput('whoami');
    if (user !== 'root') {
      console.error('Script must be run as root.');
      process.exit(1);
    }
  }

  /**
   * Checks if apt or dpkg processes are running.
   * If any of these processes are found running, the script will exit to avoid conflicts.
   */
  checkProcesses() {
    const aptRunning = this.getCommandOutput('pgrep apt');
    const dpkgRunning = this.getCommandOutput('pgrep dpkg');
    if (aptRunning || dpkgRunning) {
      console.error('Apt or Dpkg processes are currently running. Please wait for them to finish.');
      process.exit(1);
    }
  }

  /**
   * Enables maintenance mode in Nextcloud to prevent user access during the update.
   */
  enableMaintenanceMode() {
    execSync(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --on`);
    console.log('Maintenance mode enabled.');
  }

  /**
   * Disables maintenance mode in Nextcloud after the update is complete.
   */
  disableMaintenanceMode() {
    execSync(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --off`);
    console.log('Maintenance mode disabled.');
  }

  /**
   * Checks if the server has enough free disk space to proceed with the update.
   * A minimum of 50GB of free space is required.
   */
  checkFreeSpace() {
    const freeSpace = this.getCommandOutput("df -h | grep -m 1 '/' | awk '{print $4}'");
    if (parseInt(freeSpace) < 50) {
      console.error('Not enough disk space for backup. At least 50GB required.');
      process.exit(1);
    }
    console.log('Sufficient free space for backup.');
  }

  /**
   * Creates a backup of Nextcloud's config and apps directories.
   * The backup is saved in the directory defined by this.BACKUP.
   */
  createBackup() {
    if (!fs.existsSync(this.BACKUP)) {
      fs.mkdirSync(this.BACKUP, { recursive: true });
    }
    console.log('Creating a backup of Nextcloud files...');
    execSync(`rsync -Aax ${this.NCPATH}/config ${this.BACKUP}`);
    execSync(`rsync -Aax ${this.NCPATH}/apps ${this.BACKUP}`);
    console.log('Backup completed.');
  }

  /**
   * Downloads the latest stable release of Nextcloud.
   * The downloaded file is saved as nextcloud-latest.zip.
   */
  downloadNextcloud() {
    console.log('Downloading the latest Nextcloud release...');
    execSync('curl -o nextcloud-latest.zip https://download.nextcloud.com/server/releases/latest.zip');
    console.log('Nextcloud package downloaded.');
  }

  /**
   * Extracts the downloaded Nextcloud package into the web directory.
   */
  extractNextcloud() {
    console.log('Extracting Nextcloud package...');
    execSync('unzip nextcloud-latest.zip -d /var/www');
    console.log('Extraction completed.');
  }

  /**
   * Runs the Nextcloud upgrade process using the OCC command.
   * Ensures that all database changes and file migrations are completed.
   */
  upgradeNextcloud() {
    console.log('Running Nextcloud upgrade...');
    execSync(`sudo -u www-data php ${this.NCPATH}/occ upgrade`);
    console.log('Nextcloud upgrade completed.');
  }

  /**
   * Cleans up the downloaded files and temporary files created during the update.
   * This includes removing the downloaded Nextcloud package.
   */
  cleanup() {
    console.log('Cleaning up...');
    fs.unlinkSync('nextcloud-latest.zip');
    console.log('Cleanup completed.');
  }

  /**
   * Runs the full update process, including enabling maintenance mode, creating a backup,
   * downloading the latest Nextcloud release, performing the upgrade, and cleanup.
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

  /**
   * Displays a menu that allows the user to choose between a full update or performing each step manually.
   * Each option is executed based on the user's choice.
   */
  displayMenu() {
    const options = [
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
    ];

    let exit = false;

    while (!exit) {
      const choice = readlineSync.keyInSelect(options, 'Choose an option:');

      switch (choice) {
        case 0:
          this.runFullUpdate();
          break;
        case 1:
          this.enableMaintenanceMode();
          break;
        case 2:
          this.checkFreeSpace();
          break;
        case 3:
          this.createBackup();
          break;
        case 4:
          this.downloadNextcloud();
          break;
        case 5:
          this.extractNextcloud();
          break;
        case 6:
          this.upgradeNextcloud();
          break;
        case 7:
          this.cleanup();
          break;
        case 8:
          this.disableMaintenanceMode();
          break;
        case 9:
          exit = true;
          console.log('Exiting...');
          break;
        default:
          console.log('Invalid option, please try again.');
      }
    }
  }
}

// Run the menu
const updater = new ncUpdate();
updater.displayMenu();

export default ncUPDATE;

// Execute the update process
//const updater = new ncUPDATE();
//updater.runUpdate();
