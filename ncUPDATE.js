import { RED,BLUE,GRAY,GRAYLI,GREEN,YELLOW,YELLOWLI,PURPLE } from './color.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';



class ncUPDATE {
  constructor() {
    this.scriptsDir = '/var/scripts'; 
    this.ncPath = '/var/www/nextcloud';
    this.libUrl = 'https://raw.githubusercontent.com/nextcloud/vm/master/lib.sh';
    
  }

  // Load the remote script containing helper functions
  loadLib() {
    try {
      execSync(`source <(curl -sL ${this.libUrl})`);
      console.log('Loaded lib.sh successfully.');
    } catch (error) {
      console.error('Error loading lib.sh:', error);
    }
  }

  // Ensure the script is running as root
  rootCheck() {
    try {
      execSync('if [ "$EUID" -ne 0 ]; then echo "Please run as root"; exit 1; fi');
    } catch (error) {
      console.error('Root check failed:', error);
    }
  }

  // Update the Nextcloud server
  updateNextcloud() {
    this.rootCheck();
    this.loadLib();

    try {
      // Fetch variables and run Nextcloud update
      execSync('nc_update');
      console.log('Nextcloud update completed.');
    } catch (error) {
      console.error('Error updating Nextcloud:', error);
    }
  }

  // Check for updates and download if available
  checkForUpdates() {
    this.rootCheck();
    this.loadLib();

    try {
      const currentVersion = execSync('nextcloud -v').toString().trim();
      const majorVersion = parseInt(currentVersion.split('.')[0], 10);
      const nextMajorVersion = majorVersion + 1;
      const updateFilePath = path.join('/tmp', 'nextmajor.version');
      
      // Check for major version upgrade
      fs.writeFileSync(updateFilePath, `${nextMajorVersion}`);
      console.log(`Nextcloud version updated to ${nextMajorVersion}`);
    } catch (error) {
      console.error('Failed to check or update the Nextcloud version:', error);
    }
  }

  // Run maintenance mode to prepare for updates
  enableMaintenanceMode() {
    this.rootCheck();

    try {
      execSync('nextcloud_occ maintenance:mode --on');
      console.log('Maintenance mode enabled.');
    } catch (error) {
      console.error('Failed to enable maintenance mode:', error);
    }
  }

  

  // Display a simple menu using Inquirer for interaction
  async updateMenu(mainMenu,exitProgram,VARS) {
    const choices = [
      'Update Nextcloud',
      'Check for Updates',
      'Enable Maintenance Mode',
      'Exit',
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Choose an action:',
        choices,
      },
    ]);

    switch (action) {
      case 'Update Nextcloud':
        this.updateNextcloud();
        break;
      case 'Check for Updates':
        this.checkForUpdates();
        break;
      case 'Enable Maintenance Mode':
        this.enableMaintenanceMode();
        break;
      case 'Go Back':
        mainMenu();
        break;
        
      case 'Exit':
        
        console.log('Goodbye!');
        exitProgram();
        process.exit(0);
    }
  }
  
  
}

/*
async function repairNextcloud() {
  console.log('Starting Nextcloud repair process...');
  try {
      execSync('sudo -u www-data php /var/www/nextcloud/occ maintenance:repair', { stdio: 'inherit' });
      console.log('Nextcloud repair completed successfully.');
  } catch (error) {
      console.error('Failed to repair Nextcloud:', error);
  }
}

*/
export default ncUPDATE;
