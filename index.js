
/**
 * Clear any active prompts or actions before going back to the main menu
 */
function resetActiveMenu() {
    activeMenu = null;
}

async function mainMenu() {
    resetActiveMenu();  // Clear any active menus when returning to the main menu

    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                'Update Nextcloud',
                'Repair Nextcloud',
                'Manage PostgreSQL',
                'Manage PHP',
                'Manage DNS/FQDN',
                'Manage LDAP',
                'Manage Nextcloud Apps',
                'Manage Docker',
                'Manage Redis',
                'Backup',
                'Exit'
            ],
        }
    ]);

    switch (answers.action) {
        case 'Update Nextcloud':
            const updateManager = new ncUPDATE();
            return updateManager.mainMenu();
        case 'Repair Nextcloud':
            return repairNextcloud();
        case 'Manage PostgreSQL':
            const sqlManager = new ncSQL();
            return sqlManager.managePostgreSQL(mainMenu);
        case 'Manage PHP':
            const phpManager = new ncPHP();
            return phpManager.managePHP(mainMenu);
        case 'Manage DNS/FQDN':
            const dnsManager = new ncFQDN();
            return dnsManager.manageFQDN(mainMenu);
        case 'Manage LDAP':
            const ldapManager = new ncLDAP();
            if (activeMenu === 'ldap') {
                console.log('Already managing LDAP. Returning to main menu...');
                return;
            }
            activeMenu = 'ldap';
            return ldapManager.manageLDAP(mainMenu);
        case 'Manage Nextcloud Apps':
            const appsManager = new ncAPPS();
            return appsManager.manageApps(mainMenu);
        case 'Manage Docker':
            const dockerManager = new ncDocker();
            return dockerManager.manageDocker(mainMenu);
        case 'Manage Redis':
            const redisManager = new ncREDIS();
            if (activeMenu === 'redis') {
                console.log('Already managing Redis. Returning to main menu...');
                return;
            }
            activeMenu = 'redis';
            await redisManager.manageRedis(mainMenu);
            break;
        case 'Backup':
            const backupManager = new ncBAK();
            return backupManager.runBackups(mainMenu);
        case 'Exit':
            VARS.saveVariables();
            console.log(chalk.green('Goodbye!'));
            process.exit(0);
    }
}

/**
 * Make sure to reset the active menu before exiting or transitioning
 */
function exitProgram() {
    resetActiveMenu();  // Clear any active states before exiting
    console.log(chalk.green('Goodbye!'));
    process.exit(0);
}

(async () => {
    await welcome();
    await mainMenu();
})();