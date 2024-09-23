import fs from 'fs';
import { clearConsole,welcome } from './utils.js';
import { execSync } from 'child_process';
import inquirer from 'inquirer';


/**
 * Class to manage TLS activation and configuration for Nextcloud.
 * Provides functionality to set up, test, and manage TLS certificates.
 */
class ncTLS {
    constructor() {
        /**
         * @property {string} SCRIPTS - Path to the scripts directory.
         */
        this.SCRIPTS = '/var/scripts';

        /**
         * @property {string} HTML - Path to the web root directory.
         */
        this.HTML = '/var/www';

        /**
         * @property {string} NCPATH - Path to the Nextcloud installation directory.
         */
        this.NCPATH = `${this.HTML}/nextcloud`;

        /**
         * @property {string} CERTFILES - Directory where Let's Encrypt certificates are stored.
         * @description Dynamically retrieves the certificate directory for Let's Encrypt.
         */
        this.CERTFILES = '/etc/letsencrypt/live';

        /**
         * @property {string} PHPVER - Current PHP version in use.
         * @description Dynamically retrieves the PHP version using the 'php -v' command.
         */
        this.PHPVER = this.getCommandOutput('php -v | grep "^PHP" | awk \'{print $2}\'');

        /**
         * @property {string} TLSDOMAIN - Domain name for which TLS is activated.
         */
        this.TLSDOMAIN = this.getTLSConfigDomain();

        /**
         * @property {string} TLS_CONF - Path to the Apache TLS configuration file.
         */
        this.TLS_CONF = this.getTLSConfPath();

        /**
         * @property {string} DHPARAMS_TLS - Path to the DHParams file for TLS configuration.
         */
        this.DHPARAMS_TLS = '/etc/ssl/certs/dhparam.pem';

        /**
         * @property {string} LETS_ENCRYPT_CERT - Path to the Let's Encrypt certificate.
         * @description Dynamically retrieves the Let's Encrypt certificate path.
         */
        this.LETS_ENCRYPT_CERT = this.getCommandOutput("sudo certbot certificates | grep -i 'Certificate Path' | awk '{print $3}'");

        /**
         * @property {string} LETS_ENCRYPT_STATUS - Status of the Let's Encrypt certificate (Valid or Expired).
         * @description Checks the validity of the Let's Encrypt certificate using certbot.
         */
        this.LETS_ENCRYPT_STATUS = this.getCertStatus();

        /**
         * @property {Array<number>} NONO_PORTS - List of ports that shouldn't be used for public access.
         */
        this.NONO_PORTS = [22, 25, 53, 80, 443, 1024, 3012, 3306, 5178, 5432];
    }

    /**
     * Helper function to execute a shell command and return the output.
     * @param {string} command - The shell command to run.
     * @returns {string} - Output from the command.
     */
    getCommandOutput(command) {
        try {
            return execSync(command).toString().trim();
        } catch (error) {
            console.error(`Error executing command: ${command}`);
            return '';
        }
    }

    /**
     * Retrieves the domain from the TLS configuration.
     * @returns {string} - The domain used for the TLS configuration.
     */
    getTLSConfigDomain() {
        try {
            const tlsDomain = this.getCommandOutput("grep 'ServerName' /etc/apache2/sites-available/*.conf | awk '{print $2}'");
            return tlsDomain || 'domain.com';  // Fallback to default domain
        } catch (error) {
            console.error('Error fetching TLS domain:', error);
            return 'domain.com';
        }
    }

    /**
     * Retrieves the TLS configuration file path.
     * @returns {string} - The file path of the TLS configuration.
     */
    getTLSConfPath() {
        try {
            const confPath = this.getCommandOutput("ls /etc/apache2/sites-available/ | grep '.conf'");
            return `/etc/apache2/sites-available/${confPath}`;
        } catch (error) {
            console.error('Error fetching TLS configuration path:', error);
            return '/etc/apache2/sites-available/000-default.conf';
        }
    }

    /**
     * Retrieves the status of the Let's Encrypt certificate (valid or expired).
     * @returns {string} - The status of the certificate ('Valid' or 'Expired').
     */
    getCertStatus() {
        try {
            const certStatus = execSync("sudo certbot certificates | grep -i 'VALID'").toString().trim();
            return certStatus.includes('VALID') ? 'Valid' : 'Expired or Invalid';
        } catch (error) {
            console.error('Error executing certbot command or no certificates found:', error.message);
            return 'Unknown';
        }
    }
    

    /**
     * Set the domain for TLS and update the Nextcloud configuration.
     * Writes the TLS configuration for Apache.
     * 
     * @param {string} domain - The domain name to be used for TLS.
     * @example
     * ncTLS.setTLSConfig('cloud.example.com');
     */
    setTLSConfig(domain) {
        this.TLSDOMAIN = domain;
        this.TLS_CONF = `/etc/apache2/sites-available/${this.TLSDOMAIN}.conf`;
    
        const content = `
    <VirtualHost *:80>
        RewriteEngine On
        RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]
    </VirtualHost>
    
    <VirtualHost *:443>
        ServerAdmin admin@${this.TLSDOMAIN}
        ServerName ${this.TLSDOMAIN}
    
        <FilesMatch "\\.php$">
            SetHandler "proxy:unix:/run/php/php${this.PHPVER}-fpm.nextcloud.sock|fcgi://localhost"
        </FilesMatch>
    
        Header add Strict-Transport-Security: "max-age=15552000;includeSubdomains"
        SSLEngine on
        SSLCompression off
        SSLProtocol -all +TLSv1.2
        SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256
    
        DocumentRoot ${this.NCPATH}
        <Directory ${this.NCPATH}>
            Options Indexes FollowSymLinks
            AllowOverride None
            Require all granted
        </Directory>
    
        SSLCertificateFile ${this.CERTFILES}/${this.TLSDOMAIN}/fullchain.pem
        SSLCertificateKeyFile ${this.CERTFILES}/${this.TLSDOMAIN}/privkey.pem
        SSLOpenSSLConfCmd DHParameters ${this.DHPARAMS_TLS}
    </VirtualHost>
        `;
    
        try {
            // Use sudo to write the file
            execSync(`echo "${content}" | sudo tee ${this.TLS_CONF}`);
            console.log(`TLS configuration saved to ${this.TLS_CONF}`);
        } catch (error) {
            console.error(`Failed to write TLS configuration: ${error.message}`);
        }
    }
    

    /**
     * Generate a new DHParams file if it doesn't exist.
     * DHParams are used to strengthen the security of the TLS handshake.
     */
    generateDHParams() {
        if (!fs.existsSync(this.DHPARAMS_TLS)) {
            console.log('Generating DHParams file...');
            execSync(`openssl dhparam -out ${this.DHPARAMS_TLS} 2048`);
        }
    }

    /**
     * Install certbot and run the certificate generation process for the domain.
     * Certbot is used to obtain SSL certificates from Let's Encrypt.
     * 
     * @param {string} domain - The domain for which the certificate will be generated.
     * @example
     * ncTLS.installAndGenerateCert('cloud.example.com');
     */
    installAndGenerateCert(domain) {
        this.setTLSConfig(domain);
        console.log('Installing Certbot...');
        execSync('apt-get install -y certbot');

        console.log('Generating TLS certificate using Certbot...');
        const certCommand = `certbot certonly --manual --key-type ecdsa --server https://acme-v02.api.letsencrypt.org/directory --agree-tos --preferred-challenges dns -d ${domain}`;
        try {
            execSync(certCommand, { stdio: 'inherit' });
            this.generateDHParams();
        } catch (error) {
            console.error('Failed to generate TLS certificate.');
        }
    }

    /**
     * Check if the domain is reachable and if ports 80 and 443 are open.
     * 
     * @param {string} domain - The domain name to be checked.
     * @returns {boolean} - True if the domain is reachable and ports are open, false otherwise.
     * @example
     * ncTLS.checkDomainReachability('cloud.example.com');
     */
    checkDomainReachability(domain) {
        console.log(`Checking if ${domain} is reachable...`);
        const isReachable = execSync(`curl -s -o /dev/null -w "%{http_code}" http://${domain}`).toString().trim() === '200';

        if (!isReachable) {
            console.error(`The domain ${domain} is not reachable.`);
            return false;
        }

        console.log(`Domain ${domain} is reachable.`);
        this.checkPorts(domain);
        return true;
    }

    /**
     * Check if the necessary ports (80 and 443) are open for the domain using `nmap`.
     * 
     * @param {string} domain - The domain name to be checked.
     * @example
     * ncTLS.checkPorts('cloud.example.com');
     */
    checkPorts(domain) {
        console.log(`Checking if ports 80 and 443 are open for ${domain}...`);
        try {
            execSync(`nmap -p 80,443 ${domain}`);
            console.log('Ports 80 and 443 are open.');
        } catch (error) {
            console.error(`Error checking ports for ${domain}:`, error);
        }
    }

    /**
     * Restart the Apache server to apply the new TLS configuration.
     * This ensures that the changes take effect.
     * 
     * @example
     * ncTLS.restartWebServer();
     */
    restartWebServer() {
        try {
            console.log('Restarting Apache server...');
            execSync('systemctl restart apache2');
            console.log('Apache server restarted successfully.');
        } catch (error) {
            console.error('Failed to restart Apache server.', error);
        }
    }

    /**
     * Enable the new TLS configuration and disable the old one, then restart the web server.
     * 
     * @param {string} [oldConf='000-default.conf'] - The old configuration to disable.
     * @example
     * ncTLS.activateTLSConfig('old-config.conf');
     */
    activateTLSConfig(oldConf = '000-default.conf') {
        try {
            execSync(`a2ensite ${this.TLS_CONF}`);
            execSync(`a2dissite ${oldConf}`);
            this.restartWebServer();
            console.log(`TLS configuration ${this.TLS_CONF} activated, and ${oldConf} disabled.`);
        } catch (error) {
            console.error(`Failed to activate TLS configuration: ${this.TLS_CONF}`, error);
        }
    }

/**
     * Function to display the menu and handle user interactions.
     */
async certMenu() {
    let continueMenu = true;

    while (continueMenu) {
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'TLS Management Menu:',
                choices: [
                    'Set TLS Config',
                    'Install and Generate TLS Certificate',
                    'Check Domain Reachability',
                    'Check Open Ports',
                    'Activate TLS Configuration',
                    'Restart Web Server',
                    'Exit'
                ]
            }
        ]);

        switch (action) {
            case 'Set TLS Config':
                const { domain } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'domain',
                        message: 'Enter the domain for TLS configuration:'
                    }
                ]);
                this.setTLSConfig(domain);
                break;
            case 'Install and Generate TLS Certificate':
                const { certDomain } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'certDomain',
                        message: 'Enter the domain for which to generate the certificate:'
                    }
                ]);
                this.installAndGenerateCert(certDomain);
                break;
            case 'Check Domain Reachability':
                const { checkDomain } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'checkDomain',
                        message: 'Enter the domain to check reachability:'
                    }
                ]);
                this.checkDomainReachability(checkDomain);
                break;
            case 'Check Open Ports':
                const { portDomain } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'portDomain',
                        message: 'Enter the domain to check open ports:'
                    }
                ]);
                this.checkPorts(portDomain);
                break;
            case 'Activate TLS Configuration':
                const { oldConfig } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'oldConfig',
                        message: 'Enter the old configuration file to disable (default is 000-default.conf):',
                        default: '000-default.conf'
                    }
                ]);
                this.activateTLSConfig(oldConfig);
                break;
            case 'Restart Web Server':
                this.restartWebServer();
                break;
            case 'Exit':
                continueMenu = false;
                break;
            default:
                break;
        }
    }
}
}


export default ncTLS;
