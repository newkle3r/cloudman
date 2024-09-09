import chalk from 'chalk';
import inquirer from 'inquirer';
import gradient from 'gradient-string';
import chalkAnimation from 'chalk-animation';
import figlet from 'figlet';
import { createSpinner } from 'nanospinner';
import { execSync } from 'child_process';  // For executing shell commands

const RED = chalk.redBright;
const BLUE = chalk.blue;
const GREEN = chalk.green;
const YELLOW = chalk.yellow;
const GRAYLI = chalk.bgGrey;
const GRAY = chalk.gray;
const YELLOWLI = chalk.bgYellowBright;
const PURPLE = chalk.magenta;