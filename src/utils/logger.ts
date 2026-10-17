import pc from 'picocolors';

export const logger = {
  info(msg: string) {
    console.log(`${pc.cyan('ℹ')} ${msg}`);
  },
  success(msg: string) {
    console.log(`${pc.green('✔')} ${msg}`);
  },
  warn(msg: string) {
    console.log(`${pc.yellow('⚠')} ${msg}`);
  },
  error(msg: string) {
    console.error(`${pc.red('✖')} ${msg}`);
  },
  step(step: number, total: number, msg: string) {
    console.log(`${pc.magenta(`[${step}/${total}]`)} ${pc.bold(msg)}`);
  },
  title(msg: string) {
    console.log('\n' + pc.bold(pc.bgGreen(pc.black(`  ${msg}  `))) + '\n');
  },
  highlight(label: string, value: string | number) {
    console.log(`  ${pc.gray('•')} ${pc.dim(label)}: ${pc.cyan(String(value))}`);
  },
  json(data: unknown) {
    console.log(JSON.stringify(data, null, 2));
  },
};
