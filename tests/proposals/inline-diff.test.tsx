/** 用户要求的 Namefi 极简 diff：公共部分一次、灰色删除线、新值普通 span。 */
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { InlineDiff } from '../../src/web/components/proposals/InlineDiff';
import { Diff } from '../../src/web/components/proposals/Diff';
test('shared prefix and suffix appear once; only changed fragment is struck', () => {
  const html = renderToStaticMarkup(<InlineDiff before="https://example.test/v1/docs" after="https://example.test/v2/docs" />);
  expect(html).toBe('https://example.test/v<del>1</del><span class="diff-added">2</span>/docs');
});
test('unrelated values use arrow; pure insert/delete and unicode are intact', () => {
  expect(renderToStaticMarkup(<InlineDiff before="abc" after="xyz" />)).toContain('<del>abc</del><span class="diff-arrow"> → </span>xyz');
  expect(renderToStaticMarkup(<InlineDiff before="" after="New" />)).toBe('New');
  expect(renderToStaticMarkup(<InlineDiff before="Old" after="" />)).toBe('<del>Old</del>');
  expect(renderToStaticMarkup(<InlineDiff before="abc😀x" after="abc😁x" />)).toBe('abc<del>😀</del><span class="diff-added">😁</span>x');
});
test('unchanged fields disappear; changed fields retain a complete accessible comparison', () => {
  const html=renderToStaticMarkup(<Diff before={{url:'https://example.test/a',description:'old'}} after={{url:'https://example.test/a',description:'new'}}/>);
  expect(html).not.toContain('Destination'); expect(html).toContain('Before: old. Proposed: new.');
});
