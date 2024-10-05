import { RED, GREEN,YELLOW,BLUE } from './color.js';
import { execSync,spawn } from 'child_process';
import fs, { link } from 'fs';
import inquirer from 'inquirer';
import ncUTILS from './ncUTILS.js';
import ncVARS from './ncVARS.js';
import cliProgress from 'cli-progress';
import readline from 'readline';


/**
 * Class to handle the Nextcloud update process.
 * This script provides an option to run a full update or perform individual steps.
 * 
 * @class ncUPDATE
 */
class ncUPDATE {
    constructor(mainMenu) {
        let lib = new ncVARS();
        lib.loadVariables();
        lib.ncdb();
        lib.nc_update();
        this.util = new ncUTILS();
        this.SCRIPTS = lib.SCRIPTS;
        this.BACKUP = lib.BACKUP;
        this.NCPATH = lib.NCPATH;
        this.VMLOGS = lib.VMLOGS;
        this.CURRENTVERSION = lib.CURRENTVERSION; // this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ status | grep "versionstring" | awk '{print $3}'`);
        this.DISTRO = lib.DISTRO; // this.runCommand('lsb_release -sr');
        this.mainMenu = mainMenu; 
        this.lastCheck = null;
        this.awaitContinue = this.util.awaitContinue;
        this.clearConsole = this.util.clearConsole;
        this.runCommand = this.util.runCommand;
        
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
          //this.util.clearConsole(); <-- temp disable
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
        return '';  // Return an empty string in case of an error
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
   * Checks for any conflicting processes like apt or dpkg that could interfere with the update.
   * @returns {boolean} - True if conflicting processes are found, false otherwise.
   */
  checkProcesses() {
    try {
        const aptProcesses = this.runCommand('sudo pgrep apt');
        const dpkgProcesses = this.runCommand('sudo pgrep dpkg');

        if (aptProcesses || dpkgProcesses) {
            console.log(RED('Apt or other conflicting processes are running. Please wait for them to finish.'));
            return true;
        }
    } catch (error) {
        return false;
    }

  return false;
}

    /**
     * Displays the Maintenance Mode Management menu and allows the user to enable or disable maintenance mode.
     */
    async manageMaintenanceMode() {
      this.util.clearConsole();
      

      const maintenanceEnabled = this.isMaintenanceModeEnabled();
      const menuOptions = [];

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
    this.util.clearConsole();
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
        this.util.clearConsole();
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
    this.util.clearConsole();

    if (!fs.existsSync(this.BACKUP)) {
        console.log(RED(`${this.BACKUP} does not exist. Creating backup directory...`));
        await this.util.runCommandWithProgress('sudo', ['mkdir', '-p', this.BACKUP]);
        console.log(GREEN('Backup directory created.'));
    }

    console.log('Creating a backup of Nextcloud files...');

    try {
        // Create and configure the progress bar
        const progressBar = new cliProgress.SingleBar({
            format: 'Progress |{bar}| {percentage}% | ETA: {eta}s | {value}/{total}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        }, cliProgress.Presets.shades_classic);

        // Start the progress bar at 0 with an estimated total of 100
        progressBar.start(100, 0); 

        // Run rsync for config directory
        await this.runRsyncWithProgress('sudo', ['rsync', '-Aax', '--info=progress2', `${this.NCPATH}/config`, this.BACKUP], progressBar);

        // Run rsync for apps directory
        await this.runRsyncWithProgress('sudo', ['rsync', '-Aax', '--info=progress2', `${this.NCPATH}/apps`, this.BACKUP], progressBar);

        // Ensure the progress bar is completed
        progressBar.update(100);
        progressBar.stop();

        console.log(GREEN(`Backup to ${this.BACKUP} completed.`));
    } catch (error) {
        progressBar.stop();
        console.error(RED('Failed to create a backup. Please check permissions and try again.'));
        console.error(error.message);
    }

    await this.awaitContinue(); // Wait for user input before continuing
}

/**
 * Helper function to run rsync with real-time progress tracking.
 * @param {string} command - The command to run (e.g., 'sudo').
 * @param {array} args - Arguments for the command (e.g., ['rsync', ...]).
 * @param {cliProgress.SingleBar} progressBar - The progress bar to update.
 */
async runRsyncWithProgress(command, args, progressBar) {
    return new Promise((resolve, reject) => {
        const rsyncProcess = this.util.spawnCommandWithProgress(command, args);

        // Use readline to capture and process the output from rsync
        readline.createInterface({
            input: rsyncProcess.stdout,
            terminal: false
        }).on('line', (line) => {
            const progressMatch = line.match(/(\d+)%/); // Match lines with percentage
            if (progressMatch) {
                const progress = parseInt(progressMatch[1], 10);
                progressBar.update(progress);
            }
        });

        rsyncProcess.on('close', (code) => {
            if (code === 0) {
                resolve(); // Resolve on successful completion
            } else {
                reject(new Error(`rsync failed with exit code ${code}`)); // Reject if rsync fails
            }
        });

        rsyncProcess.on('error', (error) => {
            reject(error); // Reject if there's an error spawning the process
        });
    });
}
/**
 * Downloads the latest Nextcloud release with progress tracking.
 */
async downloadNextcloud() {
    this.util.clearConsole();
    const homeDir = this.runCommand('echo $HOME');
    console.log('Downloading the latest Nextcloud release to your home directory...');

    const progressBar = new cliProgress.SingleBar({
        format: 'Progress |{bar}| {percentage}% | ETA: {eta}s | {value}/{total}KB',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);

    try {
        const fileSize = await this.util.getFileSize('https://download.nextcloud.com/server/releases/latest.zip');
        progressBar.start(fileSize, 0);
        await this.runCurlWithProgress('curl', [
            '--progress-bar', 
            '--location',
            '--output', `${homeDir}/nextcloud-latest.zip`,
            'https://download.nextcloud.com/server/releases/latest.zip'
        ], fileSize, progressBar);

        progressBar.update(fileSize);
        progressBar.stop();

        console.log(GREEN('Nextcloud package downloaded to your home directory.'));
    } catch (error) {
        progressBar.stop();
        console.error(RED('Failed to download Nextcloud package.'));
        console.error(error.message);
    }

    await this.awaitContinue();
}

/**
 * Helper function to run curl with real-time progress tracking from stderr.
 * @param {string} command - The command to run (e.g., 'curl').
 * @param {array} args - Arguments for the command (e.g., ['-o', ...]).
 * @param {number} totalSize - Total size of the file in KB.
 * @param {cliProgress.SingleBar} progressBar - The progress bar to update.
 */
async runCurlWithProgress(command, args, totalSize, progressBar) {
    return new Promise((resolve, reject) => {
        const curlProcess = spawn(command, args);

        readline.createInterface({
            input: curlProcess.stderr,
            terminal: false
        }).on('line', (line) => {
            const progressMatch = line.match(/(\d{1,3})\.(\d)%/);

            if (progressMatch) {
                const percentage = parseFloat(`${progressMatch[1]}.${progressMatch[2]}`);
                const sizeDownloaded = (percentage / 100) * totalSize;
                progressBar.update(sizeDownloaded);
            }
        });

        curlProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`curl failed with exit code ${code}`));
            }
        });

        curlProcess.on('error', (error) => {
            reject(error);
        });
    });
}



    /**
   * Extracts the downloaded Nextcloud package into the /var/www/nextcloud directory with www-data permissions.
   * Warns the user that this operation will overwrite all files in their Nextcloud installation and prompts for confirmation.
   */
  async extractNextcloud() {
    this.util.clearConsole();
    const homeDir = this.runCommand('echo $HOME');
    
    console.log(RED('WARNING: You are about to overwrite ALL files in your Nextcloud installation.'));
    console.log(RED('It is strongly recommended to run a backup before proceeding.'));
    
    const { proceed } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'proceed',
            message: 'Have you run a backup and do you wish to proceed with the extraction?',
            default: false
        }
    ]);
    
    if (!proceed) {
        console.log(YELLOW('Operation aborted. Please run a backup and try again.'));
        await this.awaitContinue();
        return this.manageUpdate();  
    }

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
      this.util.clearConsole();
      console.log('Running Nextcloud upgrade...');
      this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ upgrade`);
      console.log(GREEN('Nextcloud upgrade completed.'));
      await this.awaitContinue();
  }

    /**
     * Cleans up downloaded files and temporary files from the user's home directory.
     */
    async cleanup() {
      this.util.clearConsole();
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

  autoRestartServices() {
    try {
        const distroVersion = lib.DISTRO;

        // Check if the version is between 16.04.10 and 22.04.10 (similar to the bash version comparison)
        if (parseFloat(distroVersion) < 16.04 || parseFloat(distroVersion) > 22.04) {
            
            // Check if /etc/needrestart/needrestart.conf exists, if not install needrestart
            if (!fs.existsSync('/etc/needrestart/needrestart.conf')) {
                console.log('needrestart configuration not found. Installing needrestart...');
                this.this.util.installIfNot('needrestart');
            }

            // Check if the needrestart.conf contains the correct setting for automatic restarts
            const needRestartConfig = execSync(`grep -rq "{restart} = 'a'" /etc/needrestart/needrestart.conf`).toString().trim();
            
            if (!needRestartConfig) {
                // Modify the needrestart configuration to automatically restart services
                console.log('Configuring needrestart for automatic service restarts...');
                execSync(`sudo sed -i "s|#\\$nrconf{restart} =.*|\\$nrconf{restart} = 'a';|g" /etc/needrestart/needrestart.conf`);
                console.log('needrestart configured for automatic restarts.');
            } else {
                console.log('needrestart is already configured for automatic restarts.');
            }
        } else {
            console.log('Ubuntu version is within the supported range. No need to modify needrestart configuration.');
        }
    } catch (error) {
        console.error('An error occurred while trying to configure automatic service restarts:', error);
    }
}

    /**
     * Check for pending snapshots and handle the situation by providing a message to the user.
     * If a snapshot exists, kill any `cloudman-cli` processes to prevent auto-restart.
     */
    async checkPendingSnapshot() {
        try {
            // Check if the snapshot "NcVM-snapshot-pending" exists
            const snapshotExists = this.doesSnapshotExist('NcVM-snapshot-pending');

            if (snapshotExists) {
                await inquirer.prompt([{
                    type: 'info',
                    name: 'message',
                    message: 'Cannot proceed with the update currently because NcVM-snapshot-pending exists.\n' +
                        'It is possible that a backup is currently running or an update was not successful.\n' +
                        'Advice: don\'t restart your system now if that is the case!\n\n' +
                        'If you are sure that no update or backup is currently running, you can fix this by rebooting your server.',
                }]);

                // Find all processes related to cloudman-cli
                const processList = execSync(`ps aux | grep 'cloudman-cli' | grep -v grep | awk '{print $2}'`).toString().trim();

                
                if (processList) {
                    const processIDs = processList.split('\n');
                    for (let process of processIDs) {
                        console.log(CYAN(`Killing the process with PID ${process} to prevent a potential automatic restart...`));
                        
                        try {
                            execSync(`kill ${process}`);
                            console.log(GREEN(`Successfully killed process with PID ${process}.`));
                        } catch (error) {
                            console.error(RED(`Couldn't kill the process with PID ${process}.`), error);
                        }
                    }
                }

                this.mainMenu();
            }
        } catch (error) {
            console.error(RED('An error occurred while checking for pending snapshots or killing processes.'), error);
        }
    }

    /**
     * Checks if a specific snapshot exists.
     * @param {string} snapshotName - The name of the snapshot to check.
     * @returns {boolean} - True if the snapshot exists, false otherwise.
     */
    doesSnapshotExist(snapshotName) {
        try {
            const result = execSync(`zfs list -t snapshot | grep ${snapshotName}`).toString().trim();
            return result.length > 0;
        } catch (error) {
            return false;
        }
    }
    /**
     * Function to check if a PHP extension is installed
     * @param {string} extension - The PHP extension to check (e.g., 'apcu', 'redis')
     * @returns {boolean} - True if the extension is installed, false otherwise
     */
    isPHPExtensionInstalled(extension) {
        try {
            const result = execSync(`pecl list | grep ${extension}`).toString().trim();
            return result.includes(extension);
        } catch (error) {
            return false;
        }
    }
    /**
     * Change from APCu to Redis for local cache
     */
    updateCacheToRedis() {
        const configFilePath = `${this.NCPATH}/config/config.php`;

        if (this.isPHPExtensionInstalled('apcu')) {
            // Remove any existing 'memcache.local' entry from config.php
            try {
                const configContent = fs.readFileSync(configFilePath, 'utf8');
                const updatedConfigContent = configContent.replace(/'memcache\.local'.*\n/, '');

                fs.writeFileSync(configFilePath, updatedConfigContent, 'utf8');
                console.log('Removed memcache.local from config.php');
            } catch (error) {
                console.error('Failed to modify config.php:', error);
            }


            if (this.isPHPExtensionInstalled('redis')) {
                this.util.runOccCommand('config:system:set memcache.local --value="\\OC\\Memcache\\Redis"');
            } else {
                this.util.runOccCommand('config:system:delete memcache.local');
            }
        }
    }



 /**
 * Runs the full Nextcloud update process.
 */
async runFullUpdate() {
  try {
      // Check if there are any conflicting processes
      if (await this.checkProcesses()) {
          console.log(RED('Apt or other conflicting processes are running. Please wait for them to finish.'));
          return;
      }

      // Check if there is sufficient free space
      await this.checkFreeSpace();

      // Enable maintenance mode
      console.log(BLUE('Enabling Maintenance Mode...'));
      await this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --on`);
      console.log(GREEN('Maintenance mode enabled successfully.'));

      // Create a backup of Nextcloud
      console.log(BLUE('Creating Backup...'));
      await this.createBackup();
      console.log(GREEN('Backup created successfully.'));

      // Restart if not between 16.04.10 and 22.04.10
      await this.autoRestartServices();
      await this.checkPendingSnapshot();
      await this.isPHPExtensionInstalled();
      await this.updateCacheToRedis();



      



      /*

      // Download the latest Nextcloud version
      console.log(BLUE('Downloading Nextcloud...'));
      await this.downloadNextcloud();
      console.log(GREEN('Nextcloud downloaded successfully.'));

      // Extract the downloaded Nextcloud version
      console.log(BLUE('Extracting Nextcloud...'));
      await this.extractNextcloud();
      console.log(GREEN('Nextcloud extracted successfully.'));

      // Upgrade Nextcloud
      console.log(BLUE('Upgrading Nextcloud...'));
      await this.upgradeNextcloud();
      console.log(GREEN('Nextcloud upgraded successfully.'));

      */

      // Clean up old files and processes after the upgrade
      console.log(BLUE('Cleaning up...'));
      await this.cleanup();
      console.log(GREEN('Cleanup completed successfully.'));

  } catch (error) {
      console.error(RED(`Nextcloud update failed: ${error.message}`));

      // Attempt to disable maintenance mode if an error occurs
      console.log(YELLOW('Attempting to disable maintenance mode due to an error...'));
      try {
          await this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --off`);
          console.log(GREEN('Maintenance mode disabled successfully.'));
      } catch (err) {
          console.error(RED('Failed to disable maintenance mode.'));
      }

  } finally {
      // Ensure that maintenance mode is disabled in any case
      try {
          console.log(BLUE('Ensuring Maintenance Mode is disabled...'));
          await this.runCommand(`sudo -u www-data php ${this.NCPATH}/occ maintenance:mode --off`);
          console.log(GREEN('Maintenance mode disabled.'));
      } catch (err) {
          console.error(RED('Failed to disable maintenance mode in finally block.'));
      }

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
