import chalkAnimation from 'chalk-animation';
import figlet from 'figlet';
import gradient from 'gradient-string';
import {execSync} from 'child_process';
import { GREEN, BLUE, YELLOW, PURPLE } from './color.js';  
import { spawn } from 'child_process';



/**
 * Clears the console screen.
 */
export function clearConsole() {
    console.clear();
}

/**
 * Checks the execution of a command and returns its output.
 * @param {string} command - The shell command to execute.
 * @returns {string|boolean} - The command's output if successful, false if there was an error.
 */
export function checkComponent(command) {
    try {
        return execSync(command, { encoding: 'utf8' }).toString().trim(); // Return output of command
    } catch (error) {
        console.error(`Error executing command: ${command}`, error);
        return false; 
    }
}

/**
 * Helper function to extract configuration values from the config.php file
 * @param {string} configFile - The content of config.php file
 * @param {string} key - The key to look for (e.g., 'dbname')
 * @returns {string} - The value corresponding to the key
 */
export function getConfigValue(key) {
    try {
        const configPath = `${this.NCPATH}/config/config.php`;
        // Use sudo to ensure access to config.php
        const command = `sudo grep -Po "(?<=['\\"]${key}['\\"] => ['\\"]).*?(?=['\\"])" ${configPath}`;
        return this.runCommand(command).trim();
    } catch (error) {
        console.error(`Error fetching config value for ${key}:`, error);
        return null;
    }
}

export function loadVariables() {
    try {
        const data = fs.readFileSync('./variables.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading variables.json:', error);
        return {};
    }
}

/**
 * Generalized initialization function to fetch updates/statuses
 * @param {function} fetchFunction - The function to call (e.g. getAvailableUpdates) for fetching updates.
 * @param {string} lastCheckKey - A unique key to track the last time this specific update was fetched.
 * @param {object} context - The context (like the class instance) to store lastCheck timestamps.
 * @param {number} threshold - The time threshold (in milliseconds) to determine if an update is needed.
 */
export const UPDATE_THRESHOLD = 60000;

export async function initialize(fetchFunction, lastCheckKey, context, threshold) {
    const now = new Date().getTime();
    
    if (!context[lastCheckKey] || now - context[lastCheckKey] > threshold) {
        await fetchFunction();
        context[lastCheckKey] = now; 
    }
}

/**
     * Executes a shell command and returns the output as a string.
     * @param {string} command - The command to execute.
     * @returns {string} - The command's output as a string.
     */
        export function runCommand(command) {
            try {
                // Logging the command to debug what's being passed
                console.log(`Executing command: ${command}`);
                
                // Ensure only shell commands are executed, not JavaScript
                return execSync(command, { shell: '/bin/bash' }).toString().trim();
            } catch (error) {
                console.error(`Error executing command: ${command}`, error);
                return '';
            }
        }

        export const awaitContinue = async () => {
            return new Promise((resolve) => {
                console.log('\nPress Enter to continue...');
                process.stdin.resume();
                process.stdin.setRawMode(false);
                process.stdin.once('data', () => {
                    process.stdin.pause();
                    resolve();
                });
            });
        };
/**
 * Runs a command with progress tracking, specifically for commands like `curl` that output progress on `stderr`.
 * @param {string} command - The command to run.
 * @param {number} [total=100] - The total amount for progress bar.
 * @returns {Promise<void>} - Resolves when the command is done.
 */
export function runCommandWithProgress(command, args = []) {
    return new Promise((resolve, reject) => {
        const process = spawn(command, args, { stdio: 'inherit' });

        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        process.on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * For index.js
 * Displays the welcome splash screen with system information.
 */
export async function welcome() {
    const linkText = 'Want a professional to just fix it for you? Click here!';
    const url = 'https://shop.hanssonit.se/product-category/support/';
    clearConsole();
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
    /**
     * Displays the Maintenance Mode Management menu and allows the user to enable or disable maintenance mode.
     */
 export async function manageMaintenanceMode() {
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
export async function setMaintenanceMode(enable) {
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
 * Checks if the maintenance mode is currently enabled.
 * @param {string} NCPATH - The path to the Nextcloud installation.
 * @returns {boolean} - True if maintenance mode is enabled, false otherwise.
 */
export async function isMaintenanceModeEnabled(NCPATH) {
    try {
        const output = runCommand(`sudo -u www-data php ${NCPATH}/occ maintenance:mode`);
        return output.includes('enabled: true');
    } catch (error) {
        console.error(RED('Failed to check maintenance mode status.'));
        return false;
    }
}


