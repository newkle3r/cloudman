import { execSync, exec } from 'child_process';
import { RED,GREEN,BLUE,YELLOW} from './color.js'
import { clearConsole,runCommand } from './utils.js';
import fs from 'fs';
import readlineSync from 'readline-sync';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';

/**
 * Class responsible for managing repair tasks for Nextcloud.
 * Provides options to perform auto-repair, update JSON configurations, install dependencies, and run manual repair steps via a menu.
 * 
 * @class ncREPAIR
 */
class ncREPAIR {
    constructor() {
        this.SCRIPTS_PATH = '/var/scripts';
        this.VARIABLES_JSON_PATH = '/mnt/data/variables.json';
        this.INDEX_JSON_PATH = '/mnt/data/index_json/nc_data.json';
        this.NC_OCC = 'sudo -u www-data php /var/www/nextcloud/occ';  // Fixed path for Nextcloud OCC
        this.mainMenu = this.mainMenu;
        this.runCommand = runCommand;
    }

    /**
     * Displays a menu for managing Nextcloud repair tasks.
     * Uses the mainMenu from `index.js > mainMenu()` to return to the main menu.
     * 
     * @param {Function} mainMenu - The main menu function that can be called to go back.
     * @returns {Promise<void>} - Returns a promise that resolves when the user's choice is processed.
     */
    async manageRepair(mainMenu) {
        let continueMenu = true;  
        clearConsole();

        while (continueMenu) {  
            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'Repair Nextcloud Instance:',
                    choices: [
                        'Run Native Repair Tool',
                        'Manual Repair',
                        'View Nextcloud Logs',
                        'View System Logs',
                        'Hansson IT Service-API',
                        'Contact Hansson IT',
                        'Cleanup',
                        'Exit'
                    ],
                }
            ]);

            switch (answers.action) {
                case 'Run Native Repair Tool':
                    await this.repairNextcloud();  
                    break;  

                case 'Manual Repair':
                    await this.manualRepair();  
                    break;

                case 'View Nextcloud Logs':
                    const nextcloudLogs = await this.fetchLogs();
                    nextcloudLogs.sort();
                    await this.viewLogs(nextcloudLogs);
                    break;

                case 'Hansson IT Service-API':
                    await this.serviceAPI();  
                    break;

                case 'Contact Hansson IT':
                    await this.contactSupport();  
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
     * Runs the Nextcloud repair tool using OCC command.
     * @returns {Promise<void>} - Resolves when the command completes.
     */
    async repairNextcloud() {
        clearConsole();
        const spinner = createSpinner('Repairing Nextcloud...').start();
        
        try {
            await this.runCommand(`${this.NC_OCC} maintenance:repair`);
            spinner.success({ text: `${GREEN('Nextcloud has been repaired!')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to repair Nextcloud')}` });
            console.error(error);
        }
        await this.awaitContinue();
    }

    /**
     * Runs a provided bash script for auto repair processes.
     * @returns {Promise<void>}
     */
    async autoRepair() {
      clearConsole()
        console.log('Starting auto-repair process...');
        this.runCommand(`bash ${this.SCRIPTS_PATH}/repair.sh`);
        console.log('Auto-repair completed.');
        await this.awaitContinue();
    }

    async manualRepair() {
      let continueMenu = true;
      clearConsole();

      while (continueMenu) {
          const answers = await inquirer.prompt([
              {
                  type: 'list',
                  name: 'action',
                  message: 'Manual Repair Options:',
                  choices: [
                      'Download Fresh Nextcloud Binaries',
                      'Compare Installation/Binaries',
                      'Backup Data',
                      'Overwrite Corrupt Data',
                      'Abort'
                  ],
              }
          ]);

          switch (answers.action) {
              case 'Download Fresh Nextcloud Binaries':
                  await this.downloadFreshBinaries();
                  break;

              case 'Compare Installation/Binaries':
                  await this.compareBinaries();
                  break;

              case 'Backup Data':
                  await this.backupData();
                  break;

              case 'Overwrite Corrupt Data':
                  await this.overwriteCorruptData();
                  break;

              case 'Abort':
                  console.log('Returning to previous menu...');
                  continueMenu = false;
                  break;
          }
      }
  }

  /**
   * Downloads fresh Nextcloud binaries to the system.
   * @returns {Promise<void>}
   */
  async downloadFreshBinaries() {
    clearConsole();
    const homeDir = this.runCommand('echo $HOME');
    
    // Extract version number using Nextcloud OCC command
    let versionNumber;
    try {
        const versionOutput = this.runCommand('sudo -u www-data php /var/www/nextcloud/occ -V');
        const versionMatch = versionOutput.match(/\d+\.\d+\.\d+/);
        versionNumber = versionMatch ? versionMatch[0] : null;
    } catch (error) {
        console.error('Failed to retrieve Nextcloud version:', error);
    }

    if (!versionNumber) {
        console.error('Failed to extract the Nextcloud version. Defaulting to the latest version.');
        versionNumber = 'latest';
    }

    // Use version number to form the download URL
    const downloadUrl = versionNumber === 'latest'
        ? 'https://download.nextcloud.com/server/releases/latest.zip'
        : `https://download.nextcloud.com/server/releases/nextcloud-${versionNumber}.zip`;

    console.log(`Downloading Nextcloud version ${versionNumber}...`);

    try {
        const spinner = createSpinner(`Downloading Nextcloud ${versionNumber} binaries...`).start();
        this.runCommand(`curl -o ${homeDir}/nextcloud-${versionNumber}.zip ${downloadUrl}`);
        spinner.success({ text: `Nextcloud version ${versionNumber} binaries downloaded!` });
    } catch (error) {
        console.error(`Failed to download Nextcloud version ${versionNumber} binaries:`, error);
    }

    await this.awaitContinue();
}

  /**
   * Compares the current Nextcloud installation with the freshly downloaded binaries.
   * Verifies if the zip file exists, prompts for download if missing, and unzips the file before comparing.
   * Stores the differing files in a temporary list for later use.
   * @returns {Promise<void>}
   */
  async compareBinaries() {
    clearConsole();
    const homeDir = this.runCommand('echo $HOME');
    
    // Extract version number using Nextcloud OCC command
    let versionNumber;
    try {
        const versionOutput = this.runCommand('sudo -u www-data php /var/www/nextcloud/occ -V');
        const versionMatch = versionOutput.match(/\d+\.\d+\.\d+/);  // Extract version number using regex
        versionNumber = versionMatch ? versionMatch[0] : null;
    } catch (error) {
        console.error('Failed to retrieve Nextcloud version:', error);
    }

    if (!versionNumber) {
        console.error('Failed to extract the Nextcloud version. Cannot proceed with comparison.');
        return;
    }

    const zipFilePath = `${homeDir}/nextcloud-${versionNumber}.zip`;
    const unzipDirPath = `${homeDir}/nextcloud-${versionNumber}`;
    const tempFilePath = `${homeDir}/nextcloud-diff-files.txt`;

    // Check if the zip file exists
    if (!fs.existsSync(zipFilePath)) {
        console.log(RED(`The file ${zipFilePath} does not exist.`));

        // Prompt the user to download the binaries if not found
        const { download } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'download',
                message: `Would you like to download Nextcloud version ${versionNumber} now?`,
                default: true
            }
        ]);

        if (download) {
            await this.downloadFreshBinaries();  // Call the method to download the fresh binaries
        } else {
            console.log(YELLOW('Comparison aborted.'));
            await this.awaitContinue();
            return;
        }
    }

    // Ensure the downloaded zip is unzipped before comparison
    if (!fs.existsSync(unzipDirPath)) {
        console.log(`Unzipping ${zipFilePath}...`);
        try {
            const spinner = createSpinner('Unzipping binaries...').start();
            this.runCommand(`unzip -q ${zipFilePath} -d ${unzipDirPath}`);
            spinner.success({ text: 'Unzipping completed.' });
        } catch (error) {
            console.error('Failed to unzip the Nextcloud binaries:', error);
            return;
        }
    }

    // Perform comparison using rsync with dry-run and save the differing files
    try {
        const spinner = createSpinner('Comparing files...').start();
        // Use rsync dry-run to compare current installation with fresh binaries and save differences
        const rsyncOutput = this.runCommand(`rsync -ncr ${unzipDirPath}/nextcloud/ ${this.NCPATH}/`);

        // Filter out only the file paths from the rsync output and save to a temporary file
        const differingFiles = rsyncOutput
            .split('\n')
            .filter(line => line && !line.startsWith('sending') && !line.startsWith('total size'))
            .map(line => line.trim());

        if (differingFiles.length > 0) {
            // Save differing file paths to a temporary file
            fs.writeFileSync(tempFilePath, differingFiles.join('\n'));
            console.log(GREEN(`Comparison completed. ${differingFiles.length} files differ and have been listed in ${tempFilePath}.`));
        } else {
            console.log(GREEN('No differences found between the binaries and current installation.'));
        }

        spinner.success({ text: 'Comparison completed.' });
    } catch (error) {
        console.error('Failed to compare binaries:', error);
    }

    await this.awaitContinue();
  }



  /**
   * Backups the current Nextcloud installation before any manual repair.
   * @returns {Promise<void>}
   */
  async backupData() {
      clearConsole();

      if (!fs.existsSync(this.BACKUP_PATH)) {
          console.log(`${this.BACKUP_PATH} does not exist. Creating backup directory...`);
          this.runCommand(`sudo mkdir -p ${this.BACKUP_PATH}`);
      }

      console.log('Backing up current Nextcloud data...');

      try {
          const spinner = createSpinner('Backing up...').start();
          this.runCommand(`sudo rsync -Aax ${this.NC_PATH}/config ${this.BACKUP_PATH}/`);
          this.runCommand(`sudo rsync -Aax ${this.NC_PATH}/apps ${this.BACKUP_PATH}/`);
          spinner.success({ text: 'Backup completed successfully!' });
      } catch (error) {
          console.error('Failed to backup Nextcloud data:', error);
      }

      await this.awaitContinue();
  }


  /**
   * Overwrites corrupt data in the Nextcloud installation with fresh binaries.
   * @returns {Promise<void>}
   */
  async overwriteCorruptData() {
      clearConsole();
      const homeDir = this.runCommand('echo $HOME');

      // Warn user about the potential risk of data overwrite
      console.log('WARNING: This will overwrite existing files in your Nextcloud installation.');
      console.log('Ensure you have taken a backup before proceeding.');

      const { confirmOverwrite } = await inquirer.prompt([
          {
              type: 'confirm',/**
              * Overwrites corrupt data in the Nextcloud installation with fresh binaries.
              * Gives the user the option to either overwrite all files or selectively choose which files to overwrite.
              * @returns {Promise<void>}
              */
             async overwriteCorruptData() {
                 clearConsole();
                 const homeDir = this.runCommand('echo $HOME');
                 const tempFilePath = `${homeDir}/nextcloud-diff-files.txt`;  
                 const unzipDirPath = `${homeDir}/nextcloud-${versionNumber}`;  
                 // Warn user about the potential risk of data overwrite
                 console.log(RED('WARNING: This will overwrite existing files in your Nextcloud installation.'));
                 console.log(YELLOW('Ensure you have taken a backup before proceeding.'));
             
                 const { overwriteChoice } = await inquirer.prompt([
                     {
                         type: 'list',
                         name: 'overwriteChoice',
                         message: 'Would you like to:',
                         choices: [
                             'Overwrite all files with fresh binaries',
                             'Choose which files to overwrite from the list',
                             'Abort'
                         ]
                     }
                 ]);
             
                 if (overwriteChoice === 'Abort') {
                     console.log(YELLOW('Operation aborted. No files were overwritten.'));
                     return await this.awaitContinue();
                 }
             
                 if (!fs.existsSync(tempFilePath)) {
                     console.error(RED('No differing files list found. Please run the comparison first.'));
                     await this.awaitContinue();
                     return;
                 }
             
                 const differingFiles = fs.readFileSync(tempFilePath, 'utf8').split('\n').filter(Boolean);
             
                 if (overwriteChoice === 'Choose which files to overwrite from the list') {
                     // Display the list of differing files and allow the user to select files to overwrite
                     const { selectedFiles } = await inquirer.prompt([
                         {
                             type: 'checkbox',
                             name: 'selectedFiles',
                             message: 'Select the files you want to overwrite:',
                             choices: differingFiles
                         }
                     ]);
             
                     if (selectedFiles.length === 0) {
                         console.log(YELLOW('No files were selected for overwriting.'));
                         await this.awaitContinue();
                         return;
                     }
             
                     console.log(GREEN(`Overwriting ${selectedFiles.length} selected files...`));
                     const spinner = createSpinner('Overwriting files...').start();
             
                     try {
                         // Rsync the selected files from the fresh binaries to the current installation
                         selectedFiles.forEach(file => {
                             const relativePath = file.replace(`${this.NCPATH}/`, '');  // Get the relative path
                             this.runCommand(`rsync -cr ${unzipDirPath}/nextcloud/${relativePath} ${this.NCPATH}/${relativePath}`);
                         });
                         spinner.success({ text: 'Selected files overwritten successfully!' });
                     } catch (error) {
                         spinner.error({ text: 'Failed to overwrite selected files.' });
                         console.error(error);
                     }
                 } else {
                     // Overwrite all files with fresh binaries
                     console.log(GREEN('Overwriting all files with fresh binaries...'));
                     const spinner = createSpinner('Overwriting all files...').start();
             
                     try {
                         await this.runCommand(`rsync -cr ${unzipDirPath}/nextcloud/ ${this.NCPATH}/`);
                         spinner.success({ text: 'All files overwritten successfully!' });
                     } catch (error) {
                         spinner.error({ text: 'Failed to overwrite all files.' });
                         console.error(error);
                     }
                 }
             
                 await this.awaitContinue();
             }
            }])
             
          }



    /**
     * Updates variables.json file with necessary configurations.
     * Merges the changes with existing data.
     * @param {Object} newData - New data to update in variables.json.
     * @returns {Promise<void>}
     */
    async updateVariablesJson(newData) {
        let existingData;
        try {
            existingData = JSON.parse(fs.readFileSync(this.VARIABLES_JSON_PATH, 'utf8'));  // Read variables.json
        } catch (error) {
            console.error('Error reading variables.json:', error);
            existingData = {};
        }

        const updatedData = { ...existingData, ...newData };

        try {
            fs.writeFileSync(this.VARIABLES_JSON_PATH, JSON.stringify(updatedData, null, 2));  // Write updated data
            console.log('variables.json updated successfully.');
        } catch (error) {
            console.error('Error writing to variables.json:', error);
        }
        await this.awaitContinue();
    }

    /**
     * Installs required dependencies if not present, including curl, whiptail, and other essentials.
     * @returns {Promise<void>}
     */
    async installDependencies() {
        const dependencies = ['curl', 'whiptail', 'lshw', 'net-tools', 'bash-completion', 'cron'];
        for (const dep of dependencies) {
            const isInstalled = this.runCommand(`dpkg-query -W -f='${dep}' 2>/dev/null | grep -c "ok installed"`);
            if (isInstalled !== '1') {
                console.log(`Installing ${dep}...`);
                this.runCommand(`apt-get install ${dep} -y`);  // Install dependency
            } else {
                console.log(`${dep} is already installed.`);
            }
        }
        await this.awaitContinue();
    }

    /**
     * Collects and parses input data from the user for JSON updates.
     * @param {string} prompt - The prompt message to display to the user.
     * @returns {Promise<Object>} - Parsed JSON object from user input.
     */
    async collectData(prompt) {
        let data = null;
        while (!data) {
            const input = readlineSync.question(prompt);
            try {
                data = JSON.parse(input);  // Parse user input as JSON
            } catch (error) {
                console.error('Invalid JSON format. Please try again.');
            }
        }
        return data;
    }

    /**
     * Prompts user to press Enter to continue.
     */
    async awaitContinue() {
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    }
}


export default ncREPAIR;
