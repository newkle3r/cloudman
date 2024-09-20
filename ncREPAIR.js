import { execSync } from 'child_process';
import fs from 'fs';
import readlineSync from 'readline-sync';

/**
 * Class responsible for performing various repair tasks on the Nextcloud server.
 * It provides methods for auto-repairing the system, updating JSON configurations,
 * and running manual repair steps via a menu.
 */
class ncREPAIR {
  constructor() {
    this.SCRIPTS_PATH = '/var/scripts';
    this.VARIABLES_JSON_PATH = '/mnt/data/variables.json';
    this.INDEX_JSON_PATH = '/mnt/data/index_json/nc_data.json';
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
   * Runs a provided bash script for auto repair processes.
   */
  autoRepair() {
    console.log('Starting auto-repair process...');
    this.runCommand(`bash ${this.SCRIPTS_PATH}/repair.sh`);
    console.log('Auto-repair completed.');
  }

  /**
   * Checks if the script is running as root.
   * If not, the script will exit.
   */
  checkIfRoot() {
    const user = this.runCommand('whoami');
    if (user !== 'root') {
      console.error('This script must be run as root.');
      process.exit(1);
    }
  }

  /**
   * Updates variables.json file with necessary configurations.
   * Merges the changes with existing data.
   * @param {Object} newData - New data to update in variables.json.
   */
  updateVariablesJson(newData) {
    let existingData;
    try {
      existingData = JSON.parse(fs.readFileSync(this.VARIABLES_JSON_PATH, 'utf8'));
    } catch (error) {
      console.error('Error reading variables.json:', error);
      existingData = {};
    }

    const updatedData = { ...existingData, ...newData };

    try {
      fs.writeFileSync(this.VARIABLES_JSON_PATH, JSON.stringify(updatedData, null, 2));
      console.log('variables.json updated successfully.');
    } catch (error) {
      console.error('Error writing to variables.json:', error);
    }
  }

  /**
   * Updates index_json/nc_data.json with new configuration values.
   * Merges the new data with existing entries.
   * @param {Object} newData - New data to update in nc_data.json.
   */
  updateIndexJson(newData) {
    let existingData;
    try {
      existingData = JSON.parse(fs.readFileSync(this.INDEX_JSON_PATH, 'utf8'));
    } catch (error) {
      console.error('Error reading nc_data.json:', error);
      existingData = {};
    }

    const updatedData = { ...existingData, ...newData };

    try {
      fs.writeFileSync(this.INDEX_JSON_PATH, JSON.stringify(updatedData, null, 2));
      console.log('index_json/nc_data.json updated successfully.');
    } catch (error) {
      console.error('Error writing to nc_data.json:', error);
    }
  }

  /**
   * Installs required dependencies if not present, including curl, whiptail, and other essentials.
   */
  installDependencies() {
    const dependencies = ['curl', 'whiptail', 'lshw', 'net-tools', 'bash-completion', 'cron'];
    dependencies.forEach((dep) => {
      const isInstalled = this.runCommand(`dpkg-query -W -f='${dep}' 2>/dev/null | grep -c "ok installed"`);
      if (isInstalled !== '1') {
        console.log(`Installing ${dep}...`);
        this.runCommand(`apt-get install ${dep} -y`);
      } else {
        console.log(`${dep} is already installed.`);
      }
    });
  }

  /**
   * Main function to run auto-repair, install dependencies, and update JSON configurations.
   * @param {Object} variableUpdates - New data for variables.json.
   * @param {Object} indexUpdates - New data for index_json/nc_data.json.
   */
  runAutoRepair(variableUpdates, indexUpdates) {
    this.checkIfRoot();
    this.installDependencies();
    this.autoRepair();
    this.updateVariablesJson(variableUpdates);
    this.updateIndexJson(indexUpdates);
  }

  /**
   * Displays a menu allowing users to manually select repair options, including
   * auto-repair, updating variables, installing dependencies, or exiting.
   */
  displayMenu() {
    const options = [
      'Run Auto Repair',
      'Update variables.json',
      'Update index_json/nc_data.json',
      'Install Dependencies',
      'Exit'
    ];

    let exit = false;
    while (!exit) {
      const choice = readlineSync.keyInSelect(options, 'Choose a repair option:');

      switch (choice) {
        case 0:
          this.autoRepair();
          break;
        case 1:
          const variableUpdates = this.collectData('Enter new data for variables.json (in JSON format): ');
          this.updateVariablesJson(variableUpdates);
          break;
        case 2:
          const indexUpdates = this.collectData('Enter new data for index_json/nc_data.json (in JSON format): ');
          this.updateIndexJson(indexUpdates);
          break;
        case 3:
          this.installDependencies();
          break;
        case 4:
          exit = true;
          console.log('Exiting...');
          break;
        default:
          console.log('Invalid option, please try again.');
      }
    }
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
        data = JSON.parse(input);
      } catch (error) {
        console.error('Invalid JSON format. Please try again.');
      }
    }
    return data;
  }
}

// Start the ncREPAIR process
const repairTool = new ncREPAIR();
repairTool.displayMenu();
