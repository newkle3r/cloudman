import { RED, GREEN, YELLOW } from './color.js';
import { clearConsole,welcome,checkComponent } from './ncUTILS.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';
import chalk from 'chalk';

// Needs suitable splash

/**
 * Class for managing DNS, FQDN, and ports using CLI commands.
 */
class ncFQDN {
    constructor() {}

    /**
     * Displays the menu for DNS and FQDN management tasks.
     */
    async manageFQDN(mainMenu) {

        let continueMenu = true;
        clearConsole();
        while (continueMenu === true) {

        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'DNS/FQDN management:',
                choices: [
                    'Identify FQDN',
                    'Update FQDN',
                    'Identify DNS',
                    'Update DNS',
                    'Check/Forward Ports',
                    'Apache Settings',
                    'Go Back'
                ],
            }
        ]);

        switch (answers.action) {
            case 'Identify FQDN':
                await this.identifyFQDN();
                break;
            case 'Update FQDN':
                await this.updateFQDN();
                break;
            case 'Identify DNS':
                await this.identifyDNS();
                break;
            case 'Update DNS':
                await this.updateDNS();
                break;
            case 'Check/Forward Ports':
                await this.forwardPorts();
                break;
            case 'Go Back':
                continueMenu = false;
                mainMenu();
                break;
        }
    }
}

    /**
     * Identifies the Fully Qualified Domain Name (FQDN) of the current Ubuntu system.
     */
    async identifyFQDN() {
        clearConsole();
        const spinner = createSpinner('Identifying Fully Qualified Domain Name...').start();

        try {
            const fqdn = execSync('hostname --fqdn').toString().trim();
            spinner.success({ text: `${GREEN(`FQDN is: ${fqdn}`)}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to identify FQDN')}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);

        await this.manageFQDN();
    }

    /**
     * Updates the FQDN by modifying /etc/hostname and /etc/hosts.
     */
    async updateFQDN() {
        const { newFQDN } = await inquirer.prompt([
            {
                type: 'input',
                name: 'newFQDN',
                message: 'Enter the new FQDN (e.g., cloud.example.com):',
                validate: (value) => {
                    const pass = value.match(/^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/);
                    return pass ? true : 'Please enter a valid FQDN (e.g., cloud.example.com)';
                },
            }
            
            
        ]);

        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Are you sure you want to update the FQDN to "${newFQDN}" and restart the system?`,
                default: false,
            }
        ]);

        if (confirm) {
            const spinner = createSpinner('Updating Fully Qualified Domain Name...').start();

            try {
                execSync(`echo ${newFQDN} | sudo tee /etc/hostname`);
                execSync(`sudo sed -i 's/127.0.1.1.*/127.0.1.1 ${newFQDN}/' /etc/hosts`);
                spinner.success({ text: `${GREEN(`FQDN updated to: ${newFQDN}`)}` });

                const { restartConfirm } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'restartConfirm',
                        message: 'Do you want to restart the computer now to apply changes?',
                        default: true,
                    }
                ]);

                if (restartConfirm) {
                    execSync('sudo reboot');
                } else {
                    console.log(GREEN('FQDN updated. Please restart your system later to apply the changes.'));
                }
            } catch (error) {
                spinner.error({ text: `${RED('Failed to update FQDN')}` });
                console.error(error);
            }
        } else {
            console.log(YELLOW('FQDN update canceled.'));
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);

        await this.manageFQDN();
    }

    /**
     * Identifies the DNS settings of the current Ubuntu system.
     */
    async identifyDNS() {
        clearConsole();
        const spinner = createSpinner('Identifying DNS settings...').start();
    
        try {
            // First, try using resolvectl (if available on the system)
            try {
                const dnsSettings = checkComponent('resolvectl status | grep "DNS Servers"').toString().trim();
                spinner.success({ text: chalk.green('DNS settings identified via resolvectl:') });
                console.log(dnsSettings);
            } catch {
                // Fallback to /etc/resolv.conf if resolvectl is not available
                const dnsConf = fs.readFileSync('/etc/resolv.conf', 'utf8');
                const dnsServers = dnsConf.match(/nameserver\s+(\S+)/g);
    
                if (dnsServers) {
                    spinner.success({ text: chalk.green('DNS settings identified via /etc/resolv.conf:') });
                    dnsServers.forEach(server => console.log(server));
                } else {
                    throw new Error('No DNS settings found in /etc/resolv.conf');
                }
            }
            
        } catch (error) {
            spinner.error({ text: chalk.red('Failed to identify DNS settings.') });
            console.error(error.message);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageFQDN();
        
    }

    /**
     * Updates DNS settings by modifying the Netplan configuration file.
     */
    async updateDNS() {
        clearConsole();
        const { newDNS } = await inquirer.prompt([
            {
                type: 'input',
                name: 'newDNS',
                message: 'Enter the new DNS servers (comma-separated, e.g., 1.1.1.1, 1.0.0.1):',
                validate: (value) => {
                    const dnsPattern = /^(\d{1,3}\.){3}\d{1,3}(,\s*(\d{1,3}\.){3}\d{1,3})*$/;
                    return dnsPattern.test(value) ? true : 'Please enter a valid DNS (comma-separated, e.g., 1.1.1.1, 1.0.0.1)';
                },
            }
        ]);

        const spinner = createSpinner('Updating DNS settings...').start();

        try {
            const dnsArray = newDNS.split(',').map(dns => dns.trim());
            execSync(`sudo sed -i '/^nameservers:/!b;n;c\\          addresses: [${dnsArray.join(', ')}]' /etc/netplan/50-cloud-init.yaml`);
            execSync('sudo netplan apply');
            spinner.success({ text: `${GREEN(`DNS updated to: ${newDNS}`)}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to update DNS settings')}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
        await this.manageFQDN();
    }

    /**
     * Checks and forwards ports 80 (HTTP) and 443 (HTTPS) using UFW or iptables.
     */
    async forwardPorts() {
        clearConsole();
        const spinner = createSpinner('Checking/forwarding ports...').start();

        try {
            // Check if port 80 and 443 are open with UFW
            let useIptables = false;
            try {
                execSync('which ufw', { stdio: 'ignore' });
            } catch {
                useIptables = true;
            }

            if (!useIptables) {
                const checkPort80 = execSync('sudo ufw status | grep "80/tcp"').toString().trim();
                const checkPort443 = execSync('sudo ufw status | grep "443/tcp"').toString().trim();

                if (!checkPort80) {
                    console.log(GREEN('Opening port 80 for HTTP...'));
                    execSync('sudo ufw allow 80/tcp');
                }

                if (!checkPort443) {
                    console.log(GREEN('Opening port 443 for HTTPS...'));
                    execSync('sudo ufw allow 443/tcp');
                }
            }

            if (useIptables) {
                console.log(chalk.yellow('Using iptables instead of UFW.'));
                
                const checkIptables80 = execSync('sudo iptables -L -n | grep ":80 "').toString().trim();
                const checkIptables443 = execSync('sudo iptables -L -n | grep ":443 "').toString().trim();

                if (!checkIptables80) {
                    console.log(GREEN('Forwarding port 80 for HTTP in iptables...'));
                    execSync('sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT');
                }

                if (!checkIptables443) {
                    console.log(GREEN('Forwarding port 443 for HTTPS in iptables...'));
                    execSync('sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT');
                }

                execSync('sudo netfilter-persistent save');
            }

            spinner.success({ text: `${GREEN('Ports forwarded: 80, 443')}` });
        } catch (error) {
            spinner.error({ text: `${RED('Failed to check/forward ports')}` });
            console.error(error);
        }
        await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);

        await this.manageFQDN();
    }
}

export default ncFQDN;
