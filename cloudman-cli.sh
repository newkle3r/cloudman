#!/bin/bash

# Define the repository and target directory
REPO_URL="https://github.com/newkle3r/cloudman.git"
TARGET_DIR="./cli"

# Check if the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (or use sudo)."
  exit
fi

# Install curl if not installed
if ! command -v curl &> /dev/null; then
  echo "Installing curl..."
  apt update && apt install -y curl
fi

# Install NVM (Node Version Manager)
if [ ! -d "$HOME/.nvm" ]; then
  echo "Installing NVM..."
  curl https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash
fi

# Load NVM into current shell session
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Install Node.js using NVM
echo "Installing Node.js using NVM..."
nvm install node

# Check if git is installed, if not, install git
if ! command -v git &> /dev/null; then
  echo "Installing git..."
  apt install -y git
fi

# Clone the cloudman repository into the target directory
if [ ! -d "$TARGET_DIR" ]; then
  echo "Cloning the Cloudman repository..."
  git clone "$REPO_URL" "$TARGET_DIR"
else
  echo "Cloudman repository already exists in $TARGET_DIR."
fi

# Navigate to the target directory
cd "$TARGET_DIR" || exit

# Install required npm packages
echo "Installing necessary npm packages..."
npm install chalk@^5.3.0 \
  chalk-animation@^2.0.3 \
  cli-progress@^3.12.0 \
  figlet@^1.7.0 \
  gradient-string@^2.0.2 \
  inquirer@^10.2.2 \
  nanospinner@^1.1.0 \
  openai@^4.63.0 \
  readline-sync@^1.4.10

echo "Setup complete."
