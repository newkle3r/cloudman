import { RED, GREEN,YELLOW } from './color.js';
import { clearConsole, welcome } from './utils.js';
import { execSync,spawn } from 'child_process';
import fs from 'fs';
import inquirer from 'inquirer';
import { runCommandWithProgress, initialize } from './utils.js';
import cliProgress from 'cli-progress'; 

/**
 * Class to handle the Nextcloud update process.
 * This script provides an option to run a full update or perform individual steps.
 * 
 * @class ncUPDATE
 */
class ncUPDATE {
    constructor(mainMenu) {
        this.SCRIPTS = '/var/scripts';
        this.BACKUP = '/mnt/NCBACKUP/';
        this.NCPATH = '/var/www/nextcloud';
        this.VMLOGS = '/var/log/nextcloud-vm';
        this.CURRENTVERSION = this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ status | grep "versionstring" | awk '{print $3}'`);
        this.DISTRO = this.runCommand('lsb_release -sr');
        this.mainMenu = mainMenu; 
        this.lastCheck = null;
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
                      'Manage Maintenance Mode',
                      'Check Free Space',
                      'Create Backup',
                      'Download Nextcloud',
                      'Extract Nextcloud',
                      'Run Nextcloud Upgrade',
                      'Cleanup',
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
                  this.mainMenu();
                  break;
          }
      }
  }

    /**
     * Executes a shell command and returns the output as a string.
     * @param {string} command - The command to execute.
     * @returns {string} - The command's output as a string.
     */
    runCommand(command) {
        try {
            return execSync(command, { shell: '/bin/bash' }).toString().trim();
        } catch (error) {
            console.error(`Error executing command: ${command}`, error);
            return '';
        }
    }

    /**
     * Checks whether maintenance mode is enabled or disabled.
     * @returns {boolean} - Returns true if maintenance mode is enabled, otherwise false.
     */
    isMaintenanceModeEnabled() {
      try {
          const result = this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode`);
          return result.includes('enabled: true');
      } catch (error) {
          console.error(RED('Failed to check maintenance mode status.'));
          return false;
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
     * Displays the Maintenance Mode Management menu and allows the user to enable or disable maintenance mode.
     */
    async manageMaintenanceMode() {
      clearConsole();
      
      // Check if maintenance mode is enabled or not
      const maintenanceEnabled = this.isMaintenanceModeEnabled();
      const menuOptions = [];

      // Add options to the menu based on the current maintenance mode state
      if (maintenanceEnabled) {
          menuOptions.push('✔ Enable Maintenance Mode', 'Disable Maintenance Mode', 'Abort and Go Back');
      } else {
          menuOptions.push('Enable Maintenance Mode', '✔ Disable Maintenance Mode', 'Abort and Go Back');
      }

      const { action } = await inquirer.prompt([
          {
              type: 'list',
              name: 'action',
              message: 'Maintenance Mode Management:',
              choices: menuOptions
          }
      ]);

      // Handle the selected action
      switch (action) {
          case '✔ Enable Maintenance Mode':
          case 'Enable Maintenance Mode':
              await this.setMaintenanceMode(true);
              break;

          case '✔ Disable Maintenance Mode':
          case 'Disable Maintenance Mode':
              await this.setMaintenanceMode(false);
              break;

          case 'Abort and Go Back':
              return;
      }
  }

  /**
     * Enables or disables maintenance mode in Nextcloud.
     * @param {boolean} enable - True to enable, false to disable.
     */
  async setMaintenanceMode(enable) {
    clearConsole();
    const command = enable
        ? `sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --on`
        : `sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --off`;
    
    try {
        this.runCommand(command);
        console.log(GREEN(`Maintenance mode ${enable ? 'enabled' : 'disabled'}.`));
    } catch (error) {
        console.error(RED(`Failed to ${enable ? 'enable' : 'disable'} maintenance mode.`));
    }

    await this.awaitContinue();

    
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
      const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

      if (!fs.existsSync(this.BACKUP)) {
          console.log(RED(`${this.BACKUP} does not exist. Creating backup directory...`));
          this.runCommand(`sudo mkdir -p ${this.BACKUP}`);
          console.log(GREEN('Backup directory created.'));
      }

      console.log('Creating a backup of Nextcloud files...');

      try {
          // Start the progress bar
          progressBar.start(100, 0); 

          // Use sudo to handle permissions and capture rsync progress
          runCommandWithProgress(`sudo rsync -Aax --info=progress2 ${this.NCPATH}/config ${this.BACKUP}`, progressBar);
          runCommandWithProgress(`sudo rsync -Aax --info=progress2 ${this.NCPATH}/apps ${this.BACKUP}`, progressBar);

          progressBar.update(100);
          progressBar.stop();

          console.log(GREEN('Backup completed.'));
      } catch (error) {
          progressBar.stop();
          console.error(RED('Failed to create a backup. Please check permissions and try again.'));
          console.error(error.message);
      }

      await this.awaitContinue();
    }

    async downloadNextcloud() {
      clearConsole();
      const homeDir = this.runCommand('echo $HOME');
      console.log('Downloading the latest Nextcloud release to your home directory...');
  
      try {
          await runCommandWithProgress(`curl --progress-bar -o ${homeDir}/nextcloud-latest.zip https://download.nextcloud.com/server/releases/latest.zip`, 100);
          console.log(GREEN('Nextcloud package downloaded to your home directory.'));
      } catch (error) {
          console.error(RED('Failed to download Nextcloud package.'));
          console.error(error.message);
      }
  
      await this.awaitContinue();
  }
  

    /**
   * Extracts the downloaded Nextcloud package into the /var/www/nextcloud directory with www-data permissions.
   * Warns the user that this operation will overwrite all files in their Nextcloud installation and prompts for confirmation.
   */
  async extractNextcloud() {
    clearConsole();
    const homeDir = this.runCommand('echo $HOME');
    
    // Display warning message
    console.log(RED('WARNING: You are about to overwrite ALL files in your Nextcloud installation.'));
    console.log(RED('It is strongly recommended to run a backup before proceeding.'));
    
    // Prompt user for confirmation
    const { proceed } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'proceed',
            message: 'Have you run a backup and do you wish to proceed with the extraction?',
            default: false
        }
    ]);
    
    // If user chooses not to proceed, abort the extraction
    if (!proceed) {
        console.log(YELLOW('Operation aborted. Please run a backup and try again.'));
        await this.awaitContinue();
        return this.manageUpdate();  
    }

    // Proceed with the extraction
    console.log('Extracting Nextcloud package into /var/www/nextcloud...');
    try {
        this.runCommand(`sudo -u www-data unzip ${homeDir}/nextcloud-latest.zip -d /var/www`);
        console.log(GREEN('Extraction completed into /var/www/nextcloud.'));
    } catch (error) {
        console.error(RED('Failed to extract Nextcloud package.'));
        console.error(error.message);
    }

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
  try {
      // Check if any conflicting processes (like apt) are running
      if (this.checkProcesses()) {
          console.log(RED('Apt or other conflicting processes are running. Please wait for them to finish.'));
          return;
      }

      // Check if there is sufficient free space for the update
      await this.checkFreeSpace();

      // Enable maintenance mode
      console.log(BLUE('Enabling Maintenance Mode...'));
      await this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --on`);
      console.log(GREEN('Maintenance mode enabled successfully.'));

      // Create a backup of Nextcloud
      console.log(BLUE('Creating Backup...'));
      await this.createBackup();

      // Download the latest Nextcloud version
      console.log(BLUE('Downloading Nextcloud...'));
      await this.downloadNextcloud();

      // Extract the downloaded Nextcloud version
      console.log(BLUE('Extracting Nextcloud...'));
      await this.extractNextcloud();

      // Upgrade Nextcloud
      console.log(BLUE('Upgrading Nextcloud...'));
      await this.upgradeNextcloud();

      // Clean up old files and processes after the upgrade
      console.log(BLUE('Cleaning up...'));
      await this.cleanup();

      // Disable maintenance mode after the upgrade is complete
      console.log(BLUE('Disabling Maintenance Mode...'));
      await this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --off`);
      console.log(GREEN('Maintenance mode disabled successfully.'));

      // Final success message
      console.log(GREEN('Nextcloud update completed successfully.'));
  } catch (error) {
      // Catch any error that occurs during the update process
      console.error(RED(`Nextcloud update failed: ${error.message}`));

      // Attempt to disable maintenance mode if an error occurs
      console.log(YELLOW('Attempting to disable maintenance mode due to an error...'));
      await this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --off`).catch(err => {
          console.error(RED('Failed to disable maintenance mode.'));
      });
  } finally {
      // Await user input before returning to the menu
      await this.awaitContinue();
  }
}

    /**
     * Prompts user to press Enter to continue.
     */
    async awaitContinue() {
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    }
}

export default ncUPDATE;
