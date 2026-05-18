// 全局构建戳: 固定在页面右下角的低存在感水印.
// - 任何用户/测试/oncall 都能据此辨认当前所看的是哪个构建
// - 内容可选中, 便于复制粘贴到 bug 报告里
// - SHA 点击跳转到对应 GitHub commit
// - 日期点击跳转到平台上该次部署 (Railway dashboard); 没有 deployUrl 时纯文本展示
// 配色: 半透明前景 + 深色 text-shadow, 在浅色/深色/媒体重背景下都保持可读, 又不抢主内容.

import { formatBuiltAtShort, getVersion } from "../version";

const REPO_BASE = "https://github.com/xinbenlv/open-golinks";

export function BuildStamp() {
  const v = getVersion();
  const time = formatBuiltAtShort(v.builtAt);
  const isDev = v.sha === "dev";
  const commitHref = isDev ? REPO_BASE : `${REPO_BASE}/commit/${v.sha}`;
  const title = [
    `version: ${v.version}`,
    `sha: ${v.sha}`,
    v.builtAt && `built: ${v.builtAt}`,
    v.branch && `branch: ${v.branch}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="build-stamp" title={title} aria-label="构建版本信息">
      <span>v{v.version}</span>
      <span aria-hidden="true"> · </span>
      <a href={commitHref} target="_blank" rel="noreferrer">
        {v.sha}
      </a>
      {time && (
        <>
          <span aria-hidden="true"> · </span>
          {v.deployUrl ? (
            <a href={v.deployUrl} target="_blank" rel="noreferrer" title="查看本次 Railway 部署">
              {time}
            </a>
          ) : (
            <span>{time}</span>
          )}
        </>
      )}
    </div>
  );
}
