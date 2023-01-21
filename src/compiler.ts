import { Module } from './module';
import {
  Add,
  Block,
  Call,
  CallIndirect,
  Const,
  DataType,
  DivSigned,
  DivUnsigned,
  Drop,
  IntegerDataType,
  Load,
  LocalGet,
  LocalSet,
  LocalTee,
  Mul,
  NumericDataType,
  RemSigned,
  RemUnsigned,
  Store,
  Sub,
  Instr,
  GlobalGet,
  GlobalSet,
  GlobalTee,
  PresentDataType,
  Loop,
  BranchIf,
  Branch,
  Eqz,
  Load8ZeroExt,
  Load8SignExt,
  Load16SignExt,
  Load16ZeroExt,
  Load32SignExt,
  Load32ZeroExt,
  Store8,
  Store16,
  Store32,
} from './nodes';
import { match } from 'ts-pattern';

// const trimdent = (str: string) => {
//   const trimmed = str.trim();
//   const spaces =
//   return trimmed.replace(/^\s*(.*)$/gm, ' '.repeat(spaces) + '$1');
// };

const compileSExpression = (
  sExpr: {
    fn: string;
    inlineArgs?: (string | null)[];
    blockArgs?: (string | null)[];
  },
  indent: number,
) => {
  let ret = space(indent) + `(${sExpr.fn}`;
  const filteredInlineArgs = sExpr.inlineArgs?.filter((x) => x !== null);
  const filteredBlockArgs = sExpr.blockArgs?.filter((x) => x !== null);
  if (filteredInlineArgs?.length) {
    ret += ` `;
    ret += filteredInlineArgs.join(' ');
  }
  if (filteredBlockArgs?.length) {
    ret += `\n`;
    ret += filteredBlockArgs.join('\n');
    ret += `\n` + space(indent) + `)`;
  } else {
    ret += `)`;
  }
  return ret;
};

const space = (indent: number) => ' '.repeat(indent);

const localGet = (node: LocalGet<NumericDataType>, indent = 0) => {
  return compileSExpression(
    { fn: 'local.get', inlineArgs: [`$${node.name}`] },
    indent,
  );
};

const localSet = (node: LocalSet, indent = 0) => {
  return compileSExpression(
    {
      fn: 'local.set',
      inlineArgs: [`$${node.name}`],
      blockArgs: [instr(node.value, indent + 1)],
    },
    indent,
  );
};

const localTee = (node: LocalTee<NumericDataType>, indent = 0) => {
  return compileSExpression(
    {
      fn: 'local.tee',
      inlineArgs: [`$${node.name}`],
      blockArgs: [instr(node.value, indent + 1)],
    },
    indent,
  );
};

const globalGet = (node: GlobalGet<NumericDataType>, indent = 0) => {
  return compileSExpression(
    { fn: 'global.get', inlineArgs: [`$${node.name}`] },
    indent,
  );
};

const globalSet = (node: GlobalSet, indent = 0) => {
  return compileSExpression(
    {
      fn: 'global.set',
      inlineArgs: [`$${node.name}`],
      blockArgs: [instr(node.value, indent + 1)],
    },
    indent,
  );
};

const globalTee = (node: GlobalTee<NumericDataType>, indent = 0) => {
  return compileSExpression(
    {
      fn: 'global.tee',
      inlineArgs: [`$${node.name}`],
      blockArgs: [instr(node.value, indent + 1)],
    },
    indent,
  );
};

const makeBinaryCompiler =
  <T extends { dataType: DataType; left: Instr; right: Instr }>(op: string) =>
  (node: T, indent = 0) => {
    return compileSExpression(
      {
        fn: `${node.dataType}.${op}`,
        blockArgs: [
          instr(node.left, indent + 1),
          instr(node.right, indent + 1),
        ],
      },
      indent,
    );
  };

const add = makeBinaryCompiler<Add<NumericDataType>>('add');
const sub = makeBinaryCompiler<Sub<NumericDataType>>('sub');
const mul = makeBinaryCompiler<Mul<NumericDataType>>('mul');
const divSigned = makeBinaryCompiler<DivSigned<NumericDataType>>('div_s');
const divUnsigned = makeBinaryCompiler<DivUnsigned<NumericDataType>>('div_u');
const remSigned = makeBinaryCompiler<RemSigned<NumericDataType>>('rem_s');
const remUnsigned = makeBinaryCompiler<RemUnsigned<NumericDataType>>('rem_u');

const constant = (node: Const<NumericDataType>, indent = 0) => {
  return compileSExpression(
    { fn: `${node.dataType}.const`, inlineArgs: [`${node.value}`] },
    indent,
  );
};

const call = (node: Call<DataType>, indent = 0) => {
  return compileSExpression(
    {
      fn: 'call',
      inlineArgs: [`$${node.name}`],
      blockArgs: node.args.map((arg) => instr(arg, indent + 1)),
    },
    indent,
  );
};

const callIndirect = (node: CallIndirect<DataType>, indent = 0) => {
  return compileSExpression(
    {
      fn: 'call_indirect',
      blockArgs: [
        space(indent + 1) + `$${node.tableName}`,
        ...node.params.map(
          (param) => space(indent + 1) + `(param ${param[0]})`,
        ),
        space(indent + 1) + `(result ${node.dataType})`,
        ...node.args.map((arg) => instr(arg, indent + 1)),
        instr(node.address, indent + 1),
      ],
    },
    indent,
  );
};

const block = (node: Block<DataType>, indent = 0) => {
  return compileSExpression(
    {
      fn: 'block',
      blockArgs: [
        node.name ? space(indent + 1) + `$${node.name}` : null,
        node.returnType !== 'none'
          ? space(indent + 1) + `(result ${node.returnType})`
          : null,
        ...node.body.map((x) => instr(x as any, indent + 1)),
      ],
    },
    indent,
  );
};

const drop = (node: Drop, indent = 0) => {
  return compileSExpression(
    { fn: 'drop', blockArgs: [instr(node.value, indent + 1)] },
    indent,
  );
};

const makeStoreCompiler =
  <T extends Store | Store8 | Store16 | Store32>(op: string) =>
  (node: T, indent = 0) => {
    return compileSExpression(
      {
        fn: `${node.dataType}.${op}`,
        blockArgs: [
          node.offset ? space(indent + 1) + `offset=${node.offset}` : null,
          node.align ? space(indent + 1) + `align=${node.align}` : null,
          instr(node.base, indent + 1),
          instr(node.value, indent + 1),
        ],
      },
      indent,
    );
  };

const store = makeStoreCompiler<Store>('store');
const store8 = makeStoreCompiler<Store8>('store8');
const store16 = makeStoreCompiler<Store16>('store16');
const store32 = makeStoreCompiler<Store32>('store32');

const makeLoadCompiler =
  <
    T extends
      | Load
      | Load8SignExt
      | Load8ZeroExt
      | Load16SignExt
      | Load16ZeroExt
      | Load32SignExt
      | Load32ZeroExt,
  >(
    op: string,
  ) =>
  (node: T, indent = 0) => {
    return compileSExpression(
      {
        fn: `${node.dataType}.${op}`,
        blockArgs: [
          node.offset ? space(indent + 1) + `offset=${node.offset}` : null,
          node.align !== null
            ? space(indent + 1) + `align=${node.align}`
            : null,
          instr(node.base, indent + 1),
        ],
      },
      indent,
    );
  };

const load = makeLoadCompiler<Load>('load');
const load8SignExt = makeLoadCompiler<Load8SignExt>('load8_s');
const load8ZeroExt = makeLoadCompiler<Load8ZeroExt>('load8_u');
const load16SignExt = makeLoadCompiler<Load16SignExt>('load16_s');
const load16ZeroExt = makeLoadCompiler<Load16ZeroExt>('load16_u');
const load32SignExt = makeLoadCompiler<Load32SignExt>('load32_s');
const load32ZeroExt = makeLoadCompiler<Load32ZeroExt>('load32_u');

const loop = (node: Loop, indent = 0) => {
  return compileSExpression(
    {
      fn: 'loop',
      inlineArgs: [node.name !== null ? `$${node.name}` : null],
      blockArgs: node.body.map((x) => instr(x, indent + 1)),
    },
    indent,
  );
};

const branchIf = (node: BranchIf, indent = 0) => {
  return compileSExpression(
    {
      fn: 'br_if',
      inlineArgs: [
        typeof node.branchTo === 'string'
          ? `$${node.branchTo}`
          : `${node.branchTo}`,
      ],
      blockArgs: [instr(node.cond, indent + 1)],
    },
    indent,
  );
};

const branch = (node: Branch, indent = 0) => {
  return compileSExpression(
    {
      fn: 'br',
      inlineArgs: [
        typeof node.branchTo === 'string'
          ? `$${node.branchTo}`
          : `${node.branchTo}`,
      ],
    },
    indent,
  );
};

const eqz = (node: Eqz, indent = 0) => {
  return compileSExpression(
    { fn: `${node.dataType}.eqz`, blockArgs: [instr(node.right, indent + 1)] },
    indent,
  );
};

const instr = (node: Instr, indent = 0): string => {
  return match(node)
    .with({ __nodeType: 'localGet' }, (x) => localGet(x, indent))
    .with({ __nodeType: 'localSet' }, (x) => localSet(x, indent))
    .with({ __nodeType: 'localTee' }, (x) => localTee(x, indent))
    .with({ __nodeType: 'globalGet' }, (x) => globalGet(x, indent))
    .with({ __nodeType: 'globalSet' }, (x) => globalSet(x, indent))
    .with({ __nodeType: 'globalTee' }, (x) => globalTee(x, indent))
    .with({ __nodeType: 'add' }, (x) => add(x, indent))
    .with({ __nodeType: 'sub' }, (x) => sub(x, indent))
    .with({ __nodeType: 'mul' }, (x) => mul(x, indent))
    .with({ __nodeType: 'divSigned' }, (x) => divSigned(x, indent))
    .with({ __nodeType: 'divUnsigned' }, (x) => divUnsigned(x, indent))
    .with({ __nodeType: 'remSigned' }, (x) => remSigned(x, indent))
    .with({ __nodeType: 'remUnsigned' }, (x) => remUnsigned(x, indent))
    .with({ __nodeType: 'const' }, (x) => constant(x, indent))
    .with({ __nodeType: 'call' }, (x) => call(x, indent))
    .with({ __nodeType: 'callIndirect' }, (x) => callIndirect(x, indent))
    .with({ __nodeType: 'block' }, (x) => block(x, indent))
    .with({ __nodeType: 'drop' }, (x) => drop(x, indent))
    .with({ __nodeType: 'store' }, (x) => store(x, indent))
    .with({ __nodeType: 'store8' }, (x) => store8(x, indent))
    .with({ __nodeType: 'store16' }, (x) => store16(x, indent))
    .with({ __nodeType: 'store32' }, (x) => store32(x, indent))
    .with({ __nodeType: 'load' }, (x) => load(x, indent))
    .with({ __nodeType: 'load8SignExt' }, (x) => load8SignExt(x, indent))
    .with({ __nodeType: 'load8ZeroExt' }, (x) => load8ZeroExt(x, indent))
    .with({ __nodeType: 'load16SignExt' }, (x) => load16SignExt(x, indent))
    .with({ __nodeType: 'load16ZeroExt' }, (x) => load16ZeroExt(x, indent))
    .with({ __nodeType: 'load32SignExt' }, (x) => load32SignExt(x, indent))
    .with({ __nodeType: 'load32ZeroExt' }, (x) => load32ZeroExt(x, indent))
    .with({ __nodeType: 'loop' }, (x) => loop(x, indent))
    .with({ __nodeType: 'branchIf' }, (x) => branchIf(x, indent))
    .with({ __nodeType: 'branch' }, (x) => branch(x, indent))
    .with({ __nodeType: 'eqz' }, (x) => eqz(x, indent))
    .otherwise(() => {
      throw new Error(`Unexpected ${node.__nodeType} node`);
    });
};

export const compile = (m: Module) => {
  return compileSExpression(
    {
      fn: 'module',
      blockArgs: [
        ...m.memories.flatMap((mem) => [
          compileSExpression(
            {
              fn: 'memory',
              inlineArgs: [`$${mem.name}`, `${mem.initSize}`, `${mem.maxSize}`],
            },
            1,
          ),
          compileSExpression(
            {
              fn: 'export',
              inlineArgs: [`"${mem.name}"`, `(memory $${mem.name})`],
            },
            1,
          ),
          ...mem.segments.flatMap((seg) =>
            compileSExpression(
              {
                fn: 'data',
                blockArgs: [
                  instr(seg.offset, 2),
                  space(2) +
                    `"${[...seg.data]
                      .map((d) => '\\' + d.toString(16))
                      .join('')}"`,
                ],
              },
              1,
            ),
          ),
        ]),
        ...m.tables.flatMap((table) => [
          compileSExpression(
            {
              fn: 'table',
              inlineArgs: [
                `$${table.name}`,
                `${table.initSize}`,
                `${table.maxSize}`,
                `${table.type}`,
              ],
            },
            1,
          ),
          ...table.segments.flatMap((seg) =>
            compileSExpression(
              {
                fn: 'elem',
                blockArgs: [
                  // space(2) + `(table $${table.name})`,
                  instr(seg.offset, 2),
                  space(2) + seg.elems.map((x) => `$${x}`).join(' '),
                ],
              },
              1,
            ),
          ),
        ]),
        ...m.globals.map((global) =>
          compileSExpression(
            {
              fn: 'global',
              inlineArgs: [
                `$${global.name}`,
                `(${global.mutable ? 'mut ' : ''}${global.dataType})`,
              ],
              blockArgs: [instr(global.initVal, 2)],
            },
            1,
          ),
        ),
        ...m.funcs
          .filter((func) => func.exportName)
          .map((func) =>
            compileSExpression(
              {
                fn: 'export',
                inlineArgs: [`"${func.exportName}"`, `(func $${func.name})`],
              },
              1,
            ),
          ),
        ...m.funcs.map((func) =>
          compileSExpression(
            {
              fn: 'func',
              inlineArgs: [`$${func.name}`],
              blockArgs: [
                ...func.params.map(
                  ([dt, name]) => space(2) + `(param $${name} ${dt})`,
                ),
                func.dataType !== 'none'
                  ? space(2) + `(result ${func.dataType})`
                  : null,
                ...func.locals.map(
                  ([dt, name]) => space(2) + `(local $${name} ${dt})`,
                ),
                instr(func.body, 2),
              ],
            },
            1,
          ),
        ),
        m.start !== null
          ? compileSExpression(
              {
                fn: 'start',
                inlineArgs: [`$${m.start}`],
              },
              1,
            )
          : null,
      ],
    },
    0,
  );
};

export const compilers = {
  instr,
  localGet,
  localSet,
  localTee,
  add,
  sub,
  mul,
  divSigned,
  divUnsigned,
  remSigned,
  remUnsigned,
  constant,
  call,
  callIndirect,
  module: compile,
  load,
  load8SignExt,
  load8ZeroExt,
  load16SignExt,
  load16ZeroExt,
  load32SignExt,
  load32ZeroExt,
  store,
  store8,
  store16,
  store32,
  globalGet,
  globalSet,
  globalTee,
  loop,
  branchIf,
  branch,
  eqz,
};
