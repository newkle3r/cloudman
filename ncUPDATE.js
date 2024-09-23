import { RED, GREEN } from './color.js';
import { clearConsole, welcome } from './utils.js';
import { execSync,spawn } from 'child_process';
import fs from 'fs';
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
     * 
     * @param {Function} mainMenu - The main menu function from `index.js` to return back.
     * @returns {Promise<void>} - Resolves when the user action is completed.
     */
    async manageUpdate(mainMenu) {
        let continueMenu = true;

        while (continueMenu) {
            clearConsole();
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
                    await this.runFullUpdate();
                    break;
                case 'Manage Maintenance Mode':
                    await this.manageMaintenanceMode();
                    break;
                case 'Check Free Space':
                    await this.checkFreeSpace();
                    break;
                case 'Create Backup':
                    await this.createBackup();
                    break;
                case 'Download Nextcloud':
                    await this.downloadNextcloud();
                    break;
                case 'Extract Nextcloud':
                    await this.extractNextcloud();
                    break;
                case 'Run Nextcloud Upgrade':
                    await this.upgradeNextcloud();
                    break;
                case 'Cleanup':
                    await this.cleanup();
                    break;
                case 'Exit':
                    console.log(GREEN('Returning to main menu...'));
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
    async checkProcesses() {
        const aptRunning = this.runCommand('pgrep apt');
        const dpkgRunning = this.runCommand('pgrep dpkg');
        if (aptRunning || dpkgRunning) {
            console.error(RED('Apt or Dpkg processes are currently running. Please wait for them to finish.'));
            process.exit(1);
        }
    }

    /**
     * Displays a menu to manage maintenance mode in Nextcloud.
     * The menu will show whether maintenance mode is currently enabled or disabled.
     */
    async manageMaintenanceMode() {
      clearConsole();

      // Check current status of maintenance mode
      const isMaintenanceEnabled = this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode | grep -c "enabled: true"`);

      // Menu options with a clear indication of current state
      const choices = [
          { name: `Enable Maintenance Mode ${isMaintenanceEnabled ? '(Currently Active)' : ''}`, value: 'enable' },
          { name: `Disable Maintenance Mode ${!isMaintenanceEnabled ? '(Currently Inactive)' : ''}`, value: 'disable' },
          { name: 'Abort and Go Back', value: 'abort' }
      ];

      const { action } = await inquirer.prompt([
          {
              type: 'list',
              name: 'action',
              message: 'Maintenance Mode Management:',
              choices: choices
          }
      ]);

      switch (action) {
          case 'enable':
              if (isMaintenanceEnabled) {
                  console.log(GREEN('Maintenance mode is already enabled.'));
              } else {
                  this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --on`);
                  console.log(GREEN('Maintenance mode enabled.'));
              }
              break;

          case 'disable':
              if (!isMaintenanceEnabled) {
                  console.log(GREEN('Maintenance mode is already disabled.'));
              } else {
                  this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --off`);
                  console.log(GREEN('Maintenance mode disabled.'));
              }
              break;

          case 'abort':
              console.log(GREEN('Returning to the previous menu...'));
              break;
      }

      await this.awaitContinue();
      return this.manageUpdate(); // Assuming you want to return to the update management menu.
  }

  /**
   * Prompts user to press Enter to continue.
   */
  async awaitContinue() {
      await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
  }

 

    /**
     * Checks if the server has enough free disk space for the update.
     */
    async checkFreeSpace() {
        clearConsole();
        const freeSpace = this.runCommand("df -h | grep -m 1 '/' | awk '{print $4}'");
        if (parseInt(freeSpace) < 50) {
            console.error(RED('Not enough disk space for backup. At least 50GB required.'));
            process.exit(1);
        }
        console.log(GREEN('Sufficient free space for backup.'));
        await this.awaitContinue();
    }

    /**
     * Creates a backup of Nextcloud's config and apps directories.
     */
    async createBackup() {
        clearConsole();
        if (!fs.existsSync(this.BACKUP)) {
            fs.mkdirSync(this.BACKUP, { recursive: true });
        }
        console.log('Creating a backup of Nextcloud files...');
        this.runCommand(`rsync -Aax ${this.NCPATH}/config ${this.BACKUP}`);
        this.runCommand(`rsync -Aax ${this.NCPATH}/apps ${this.BACKUP}`);
        console.log(GREEN('Backup completed.'));
        await this.awaitContinue();
    }

    /**
     * Downloads the latest Nextcloud release to the home directory of the current user with a progress bar.
     */
    async downloadNextcloud() {
      clearConsole();
      const homeDir = this.runCommand('echo $HOME');
      console.log(GREEN('Downloading the latest Nextcloud release to your home directory...'));

      return new Promise((resolve, reject) => {
          const downloadProcess = spawn('curl', [
              '-#', // This is the progress bar option for curl
              '-o', `${homeDir}/nextcloud-latest.zip`,
              'https://download.nextcloud.com/server/releases/latest.zip'
          ]);

          downloadProcess.stdout.on('data', (data) => {
              process.stdout.write(data); // Write curl's progress bar to stdout
          });

          downloadProcess.stderr.on('data', (data) => {
              process.stderr.write(data);
          });

          downloadProcess.on('close', (code) => {
              if (code === 0) {
                  console.log(GREEN('\nNextcloud package downloaded successfully.'));
                  resolve();
              } else {
                  console.error(RED('\nFailed to download Nextcloud package.'));
                  reject(new Error(`Download process exited with code ${code}`));
              }
          });
      }).finally(async () => {
          await this.awaitContinue();
      });
  }

    /**
     * Extracts the downloaded Nextcloud package into the /var/www/nextcloud directory with www-data permissions.
     */
    async extractNextcloud() {
      clearConsole();
      const homeDir = this.runCommand('echo $HOME');
      console.log('Extracting Nextcloud package...');
      this.runCommand(`sudo -u www-data unzip ${homeDir}/nextcloud-latest.zip -d /var/www`);
      console.log(GREEN('Extraction completed into /var/www.'));
      await this.awaitContinue();
  }

    /**
     * Runs the Nextcloud upgrade using the OCC command as www-data.
     */
    async upgradeNextcloud() {
      clearConsole();
      console.log('Running Nextcloud upgrade...');
      this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ upgrade`);
      console.log(GREEN('Nextcloud upgrade completed.'));
      await this.awaitContinue();
  }

    /**
     * Cleans up downloaded files and temporary files from the user's home directory.
     */
    async cleanup() {
      clearConsole();
      const homeDir = this.runCommand('echo $HOME');
      console.log('Cleaning up downloaded files...');
      if (fs.existsSync(`${homeDir}/nextcloud-latest.zip`)) {
          fs.unlinkSync(`${homeDir}/nextcloud-latest.zip`);
          console.log(GREEN('Cleanup completed.'));
      } else {
          console.log(RED('No downloaded files found to clean.'));
      }
      await this.awaitContinue();
  }

    /**
     * Runs the full Nextcloud update process.
     */
    async runFullUpdate() {
        this.checkProcesses();
        await this.checkFreeSpace();
        await this.enableMaintenanceMode();
        await this.createBackup();
        await this.downloadNextcloud();
        await this.extractNextcloud();
        await this.upgradeNextcloud();
        await this.cleanup();
        await this.disableMaintenanceMode();
        console.log(GREEN('Nextcloud update completed successfully.'));
        await this.awaitContinue();
    }

    /**
     * Prompts user to press Enter to continue.
     */
    async awaitContinue() {
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    }
}

export default ncUPDATE;
