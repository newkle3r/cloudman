import { RED, GREEN, YELLOW } from './color.js';
import ncUTILS from './ncUTILS.js';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ncVARS from './ncVARS.js';
import fs from 'fs';

// Needs suitable splash

/**
 * Class for managing DNS, FQDN, and ports using CLI commands.
 */
class ncFQDN {
    constructor(mainMenu) {
        this.mainMenu = mainMenu;
        this.util = new ncUTILS();
        this.vars = new ncVARS();
        this.checkComponent = this.util.checkComponent;
        this.clearConsole = this.util.clearConsole;
        this.runCommand = this.util.runCommand;
        this.trustedDomains = this.vars.DEDYNDOMAIN;

    }

    /**
     * Displays the menu for DNS and FQDN management tasks.
     */
    async manageFQDN(mainMenu) {

        let continueMenu = true;
        this.clearConsole();
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
            case 'Apache Settings':
                await this.apacheSettings();
                break;
            case 'Go Back':
                continueMenu = false;
                this.mainMenu();
                break;
        }
    }
}

    /**
     * Identifies the Fully Qualified Domain Name (FQDN) of the current Ubuntu system.
     */
    async identifyFQDN() {
        this.clearConsole();
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
        this.clearConsole();
        const spinner = createSpinner('Identifying DNS settings...').start();
    
        try {
            try {
                const dnsSettings = this.checkComponent('resolvectl status | grep "DNS Servers"').toString().trim();
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
        this.clearConsole();
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
 * If netfilter-persistent is missing, it alerts the user or tries to install it.
 */
async forwardPorts() {
    this.clearConsole();
    const spinner = createSpinner('Checking/forwarding ports...').start();
    const utils = new ncUTILS();
    let useIptables = false;

    try {
        if (utils.isProgramInstalled('ufw')) {
            const ufwStatus = this.vars.getServiceStatus('ufw');

            if (ufwStatus === 'active') {
                console.log(GREEN('UFW is active, managing ports using UFW...'));

                try {
                    const ufwStatus80 = this.runCommand('sudo ufw status | grep "80/tcp"');
                    const ufwStatus443 = this.runCommand('sudo ufw status | grep "443/tcp"');

                    if (ufwStatus80.includes('ALLOW')) {
                        console.log(YELLOW('Port 80 already open via UFW'));
                    } else {
                        console.log(GREEN('Allowing port 80 for HTTP using UFW...'));
                        this.runCommand('sudo ufw allow 80/tcp');
                    }

                    if (ufwStatus443.includes('ALLOW')) {
                        console.log(YELLOW('Port 443 already open via UFW'));
                    } else {
                        console.log(GREEN('Allowing port 443 for HTTPS using UFW...'));
                        this.runCommand('sudo ufw allow 443/tcp');
                    }

                    this.runCommand('sudo ufw reload');
                } catch (error) {
                    console.error(RED('Error managing UFW:'), error.message);
                    useIptables = true; 
                }
            } else {
                console.log(YELLOW('UFW is not active, falling back to iptables...'));
                useIptables = true;
            }
        } else {
            console.log(YELLOW('UFW is not installed, falling back to iptables...'));
            useIptables = true;
        }

        if (useIptables) {
          

            console.log(GREEN('Managing ports using iptables...'));

            const route80 = this.runCommand(`sudo iptables -L -n | grep ":80" | awk '{print $1,$7}'`);
            const route443 = this.runCommand(`sudo iptables -L -n | grep ":443" | awk '{print $1,$7}'`);

            if (route80.includes('ACCEPT') && route80.includes('dpt:80')) {
                console.log(YELLOW('Port 80 already open via iptables'));
            } else {
                console.log(GREEN('Forwarding port 80 for HTTP using iptables...'));
                this.runCommand('sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT');
            }

            if (route443.includes('ACCEPT') && route443.includes('dpt:443')) {
                console.log(YELLOW('Port 443 already open via iptables'));
            } else {
                console.log(GREEN('Forwarding port 443 for HTTPS using iptables...'));
                this.runCommand('sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT');
            }

            if (!utils.isProgramInstalled('netfilter-persistent')) {
                console.log(RED('netfilter-persistent is not installed.'));
                console.log(YELLOW('You can install it using: sudo apt install netfilter-persistent'));
            } else {
                this.runCommand('sudo netfilter-persistent save');
            }
        }

        spinner.success({ text: `${GREEN('Ports forwarded: 80 (HTTP), 443 (HTTPS)')}` });
    } catch (error) {
        spinner.error({ text: `${RED('Failed to check/forward ports')}` });
        console.error(RED('Error details:'), error.message);
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    await this.manageFQDN();
}
async apacheSettings() {
    this.util.clearConsole();
    const spinner = createSpinner('Checking Apache settings...').start();
    const requiredMods = [
        'access_compat', 'alias', 'auth_basic', 'authn_core', 'authn_file',
        'authz_core', 'authz_host', 'authz_user', 'autoindex', 'deflate',
        'dir', 'env', 'filter', 'headers', 'http2', 'mime', 'mpm_event',
        'negotiation', 'proxy', 'proxy_fcgi', 'reqtimeout', 'rewrite',
        'setenvif', 'socache_shmcb', 'ssl', 'status'
    ];

    let missingMods = [];
    let trustedDomains = [];

    try {
        for (let mod of requiredMods) {
            try {
                const modStatus = execSync(`sudo a2query -m ${mod}`, { stdio: 'pipe' }).toString();
                if (!modStatus.includes('enabled')) {
                    missingMods.push(mod);
                }
            } catch (error) {
                console.error(RED(`Error checking status of mod ${mod}: ${error.message}`));
                missingMods.push(mod);
            }
        }

        if (missingMods.length === 0) {
            spinner.success({ text: `${GREEN('All necessary Apache mods for Nextcloud are already enabled.')}` });
        } else {
            spinner.warn({ text: `${YELLOW('Some Apache mods needed for Nextcloud are not enabled.')}` });

            console.log(YELLOW('Missing mods: '), RED(missingMods.join(', ')));

            const { activateMods } = await inquirer.prompt([{
                type: 'confirm',
                name: 'activateMods',
                message: `Do you want to activate the missing mods?`,
                default: true
            }]);

            if (activateMods) {
                for (let mod of missingMods) {
                    try {
                        console.log(GREEN(`Activating mod: ${mod}`));
                        execSync(`sudo a2enmod ${mod}`, { stdio: 'inherit' });
                    } catch (error) {
                        console.error(RED(`Failed to activate mod ${mod}: ${error.message}`));
                    }
                }

                console.log(GREEN('Restarting Apache...'));
                execSync('sudo systemctl restart apache2', { stdio: 'inherit' });
                spinner.success({ text: `${GREEN('Apache mods activated and Apache restarted successfully.')}` });
            } else {
                spinner.error({ text: `${RED('Apache mod activation canceled by the user.')}` });
            }
        }

        const configPath = '/var/www/nextcloud';
        trustedDomains = this.util.getConfigValue('trusted_domains', configPath);
        trustedDomains = trustedDomains.filter(domain => domain !== 'localhost' && !domain.match(/^\d+\.\d+\.\d+\.\d+$/));  // <- ilter out localhost and IPs

        console.log(`Trusted domains extracted: ${trustedDomains}`);

        const availableSites = fs.readdirSync('/etc/apache2/sites-available')
            .filter(file => file.endsWith('.conf') && !['000-default.conf', 'nextcloud_http_domain_self_signed.conf', 'nextcloud_tls_domain_self_signed.conf', 'default-ssl.conf'].includes(file))
            .map(file => file.replace('.conf', ''));

        console.log(`Available sites: ${availableSites}`);

        for (let domain of trustedDomains) {
            if (availableSites.includes(domain)) {
                try {
                    const siteStatus = execSync(`sudo a2query -s ${domain}`, { stdio: 'pipe' }).toString();
                    if (!siteStatus.includes('enabled')) {
                        console.log(GREEN(`Activating site: ${domain}`));
                        execSync(`sudo a2ensite ${domain}.conf`, { stdio: 'inherit' });
                    }
                } catch (error) {
                    console.error(RED(`Error activating site ${domain}: ${error.message}`));
                }
            } else {
                console.log(YELLOW(`No available site configuration found for trusted domain: ${domain}`));
            }
        }

        try {
            const defaultConfStatus = execSync('sudo a2query -s 000-default', { stdio: 'pipe' }).toString();
            if (defaultConfStatus.includes('enabled')) {
                console.log(YELLOW('Deactivating 000-default.conf...'));
                execSync('sudo a2dissite 000-default.conf', { stdio: 'inherit' });
                execSync('sudo systemctl restart apache2', { stdio: 'inherit' });
            }
        } catch (error) {
            console.error(RED(`Error deactivating 000-default.conf: ${error.message}`));
        }

        spinner.success({ text: `${GREEN('Apache settings configured successfully.')}` });
    } catch (error) {
        spinner.error({ text: `${RED('Failed to configure Apache settings')}` });
        console.error(RED('Error details:'), error.message);
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
    await this.mainMenu(); 
}


}

export default ncFQDN;
