// THE STATIC CHECK FOR EVERY UI PART, written by Claude before any builder ran (Workshop OS mould, cast into the Hub 24 Oct 2026).
// node ui-static.mjs <candidate.ts> <selector> <ClassName> [--keep-motion]   -> PASS n/n or the failures
import { readFileSync } from 'node:fs';
const [src, sel, cls, ...fl] = process.argv.slice(2); const code = readFileSync(src, 'utf8'); const faults = []; let n = 0;
const t = (name, ok) => { n++; if (!ok) faults.push('FAILED: ' + name); };
const styles = (code.match(/styles:\s*\[\s*`([\s\S]*?)`\s*\]/) || [, ''])[1];
const tpl = (code.match(/template:\s*`([\s\S]*?)`\s*,\s*(styles|host|changeDetection|\})/) || [, ''])[1];
t('selector ' + sel, code.includes(`selector: '${sel}'`));
t('class ' + cls + ' exported', new RegExp(`export class ${cls}\\b`).test(code));
t('standalone', /standalone:\s*true/.test(code));
t('no svg typed by hand', !/<svg/i.test(code));
t('no em or en dash', !/[—–]/.test(code));
if (!fl.includes('--keep-colour')) t('no hex, rgb or named colour in styles', !/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|:\s*(white|black|red|green|blue|grey|gray)\b/.test(styles));
t('no box-shadow, no gradient', !/box-shadow|gradient\(/.test(styles));
t('no text-transform uppercase', !/uppercase/.test(styles));
if (!fl.includes('--keep-motion')) t('no animation loops or keyframes', !/@keyframes|animation\s*:/.test(styles));
t('no `any`', !/:\s*any\b|as any\b|<any>/.test(code));
t('no Date.now or new Date()', !/Date\.now\(\)|new Date\(\)/.test(code));
t('new control flow only (no NgIf, NgFor, CommonModule)', !/NgIf|NgFor|CommonModule|\*ngIf|\*ngFor/.test(code));
t('icons through bb-icon', !/<img[^>]+icon/i.test(tpl));
t('no comma before and/or in the words', !/,\s+(and|or|but|nor)\b/.test(tpl.replace(/\{\{[\s\S]*?\}\}/g, '')));
t('no font-family set', !/font-family/.test(styles));
/* the Hub adds: every button and link names itself for the click path, and an input() is read as a call */
const tags = [...tpl.matchAll(/<(button|a)\b[^>]*>/g)].map(m => m[0]); t('every button and link carries data-act', tags.every(x => /data-act=/.test(x)));
t('buttons say type="button"', [...tpl.matchAll(/<button\b[^>]*>/g)].every(m => /type="button"/.test(m[0])));
t('no ngModel (the parts own their state in signals)', !/ngModel/.test(code) || fl.includes('--model'));
console.log(faults.length ? 'FAIL ' + (n - faults.length) + '/' + n + '\n  ' + faults.join('\n  ') : 'PASS ' + n + '/' + n);
process.exit(faults.length ? 1 : 0);
