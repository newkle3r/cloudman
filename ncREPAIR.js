import { execSync } from 'child_process';
import { clearConsole,welcome } from './utils.js';
import fs from 'fs';
import readlineSync from 'readline-sync';


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
    const nextcloudOCC = 'sudo -u www-data php /var/www/nextcloud/occ';
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
   * Displays a menu for managing Nextcloud repair tasks.
   * Uses the mainMenu from `index.js > mainMenu()` to return to the main menu.
   * 
   * @param {Function} mainMenu - The main menu function that can be called to go back.
   * @see answers.action - Handles the user's choice in the repair management menu.
   * @returns {Promise<void>} - Returns a promise that resolves when the user's choice is processed.
   */
  async manageRepair(mainMenu) {
    let continueMenu = true;  

    while (continueMenu) {  
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Repair management:',
                choices: [
                    'Run Auto Repair',
                    'Update variables.json',
                    'Update index_json/nc_data.json',
                    'Install Dependencies',
                    'Exit'
                ],
            }
        ]);

        switch (answers.action) {
            case 'Run Auto Repair':
                await this.autoRepair();  
                break;  

            case 'Update variables.json':
                const variableUpdates = await this.collectData('Enter new data for variables.json (in JSON format): ');
                await this.updateVariablesJson(variableUpdates);
                break;

            case 'Update index_json/nc_data.json':
                const indexUpdates = await this.collectData('Enter new data for index_json/nc_data.json (in JSON format): ');
                await this.updateIndexJson(indexUpdates);
                break;

            case 'Install Dependencies':
                await this.installDependencies();  
                break;

            case 'Exit':
                continueMenu = false;  
                mainMenu();  
                break;
        }
    }
    
}

  /**
   * Runs a provided bash script for auto repair processes.
   * @returns {void}
   */
  autoRepair() {
    console.log('Starting auto-repair process...');
    this.runCommand(`bash ${this.SCRIPTS_PATH}/repair.sh`);  
    console.log('Auto-repair completed.');
  }

  /**
   * Checks if the script is running as root.
   * Exits if not running as root.
   * @returns {void}
   */
  checkIfRoot() {
    const user = this.runCommand('whoami');  // Check current user
    if (user !== 'root') {
      console.error('This script must be run as root.');
      process.exit(1);
    }
  }

  /**
   * Updates variables.json file with necessary configurations.
   * Merges the changes with existing data.
   * @param {Object} newData - New data to update in variables.json.
   * @returns {void}
   */
  updateVariablesJson(newData) {
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
  }

  /**
   * Updates index_json/nc_data.json with new configuration values.
   * Merges the new data with existing entries.
   * @param {Object} newData - New data to update in nc_data.json.
   * @returns {void}
   */
  updateIndexJson(newData) {
    let existingData;
    try {
      existingData = JSON.parse(fs.readFileSync(this.INDEX_JSON_PATH, 'utf8'));  // Read nc_data.json
    } catch (error) {
      console.error('Error reading nc_data.json:', error);
      existingData = {};
    }

    const updatedData = { ...existingData, ...newData };

    try {
      fs.writeFileSync(this.INDEX_JSON_PATH, JSON.stringify(updatedData, null, 2));  // Write updated data
      console.log('index_json/nc_data.json updated successfully.');
    } catch (error) {
      console.error('Error writing to nc_data.json:', error);
    }
  }

  /**
   * Installs required dependencies if not present, including curl, whiptail, and other essentials.
   * @returns {void}
   */
  installDependencies() {
    const dependencies = ['curl', 'whiptail', 'lshw', 'net-tools', 'bash-completion', 'cron'];
    dependencies.forEach((dep) => {
      const isInstalled = this.runCommand(`dpkg-query -W -f='${dep}' 2>/dev/null | grep -c "ok installed"`);  // Check if installed
      if (isInstalled !== '1') {
        console.log(`Installing ${dep}...`);
        this.runCommand(`apt-get install ${dep} -y`);  // Install dependency
      } else {
        console.log(`${dep} is already installed.`);
      }
    });
  }

  /**
   * Collects and parses input data from the user for JSON updates.
   * @param {string} prompt - The prompt message to display to the user.
   * @returns {Object} - Parsed JSON object from user input.
   */
  collectData(prompt) {
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
}

export default ncREPAIR;