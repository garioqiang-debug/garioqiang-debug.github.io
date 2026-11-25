// 构建：把 JSON 数据与 app.js 夹进模板，产出自包含单文件
// 用法：在「课程」目录下执行 node build.js（所有路径相对本文件，换机器不用改）
const fs = require('fs');
const path = require('path');
const dir = __dirname + path.sep;

const tpl  = fs.readFileSync(dir + 'index.tpl.html', 'utf8');
const data = JSON.parse(fs.readFileSync(dir + 'course-data.json', 'utf8'));
const app  = fs.readFileSync(dir + 'app.js', 'utf8');

const dataBlock = 'const DATA = ' + JSON.stringify(data, null, 0) + ';';
// 注意：必须用函数式替换，否则替换串里的 $$ / $& 会被当成特殊模式（会把 $("#x") 写坏）
let out = tpl.replace('/*__DATA__*/', function () { return dataBlock; })
              .replace('/*__APP__*/', function () { return app; });
fs.writeFileSync(dir + 'index.html', out, 'utf8');

// 自检
const ids = data.COURSES.map(c => c.id);
const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
const tagsBad = data.COURSE_TAGS.flatMap(t => t.courses).filter(id => !ids.includes(id));
const fmtBad = data.FORMATS.flatMap(f => f.cases).filter(id => !ids.includes(id));
console.log('课程', ids.length, '重复id', dup.length, '标签指向未知课程', tagsBad.length, '形态案例未知', fmtBad.length);
console.log('字符数', out.length, '残留占位', /__DATA__|__APP__/.test(out));