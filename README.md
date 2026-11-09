# writer

블로그 글의 초안 작성, 검토, 수정을 돕는 LLM 에이전트다. MCP 서버로 동작해서 Claude Code 같은 MCP 클라이언트에서 도구로 호출한다.

도구는 글 목록 `list_posts`, 초안 템플릿 `get_template`, 규칙 검사 `check_post`, 검토 `review_post`, 수정 `revise_post`가 있다. 초안은 호출한 쪽이 `get_template`을 받아 조사하고 쓴다. 서버 안에서 LLM을 부르는 도구는 검토와 수정뿐이다. 구조와 설계 이유는 [docs/architecture.md](docs/architecture.md), 규칙과 판단은 [docs/rules.md](docs/rules.md)에 있다.

## 요구 사항

- Node.js 22 이상
- 검사할 사이트의 레포와, 글의 frontmatter를 정의한 JSON Schema 파일
- 사이트 레포의 템플릿 파일 (아래 [템플릿 파일](#템플릿-파일))

Astro 사이트라면 `astro sync`, `astro dev`, `astro build` 중 하나를 돌렸을 때 스키마 파일이 `.astro/collections/`에 만들어진다.

## 설치

```sh
npm install
npm run build
```

## 설정

환경변수로 받는다. 경로는 `SITE_ROOT` 기준이고, 생략하면 Astro 기본값을 쓴다.

| 변수 | 기본값 | 설명 |
|---|---|---|
| `SITE_ROOT` | 필수 | 사이트 레포 루트 |
| `WRITER_CONTENT_DIR` | `src/content/blog` | 글 폴더 |
| `WRITER_SCHEMA` | `.astro/collections/blog.schema.json` | frontmatter JSON Schema |
| `WRITER_GUIDE` | `writer.guide.md` | 사이트 글쓰기 안내 문서. writer의 내장 원칙에 더해 초안, 검토, 수정에 쓰인다. 호출할 때마다 읽으므로 고치면 바로 반영된다. 없으면 내장 원칙만 쓴다 |
| `WRITER_TEMPLATES` | `writer.templates.json` | 글 템플릿 파일. 없으면 내장 `article` 템플릿 하나만 쓴다 |
| `LLM_PROVIDER` | `claude-code` | LLM 호출 방식. `claude-code`(Claude 구독) 또는 `anthropic-api`(API 키, 사용량 과금) |
| `WRITER_MODEL` | Provider 기본값 | 모델 ID |
| `WRITER_CLAUDE_BIN` | `claude` | `claude-code` Provider가 실행할 파일. 셸을 거치지 않으므로 npm으로 설치한 Windows에서는 `claude.exe`의 전체 경로를 적는다 |

값이 잘못되면 서버가 시작하지 않고 stderr에 이유를 출력한다.

`claude-code` Provider는 본인이 개인 툴로 쓰는 용도다. 남이 쓸 때는 `anthropic-api` Provider를 쓴다.

## 템플릿 파일

모든 도구의 `template` 입력 값이 이 파일에서 나온다. 템플릿은 가이드라인이라서 절이 빠지거나 이름이 달라도 위반이 아니다.

```json
{
  "default": "article",
  "templates": {
    "article": { "description": "General post", "referencesHeading": "참고 자료" },
    "escape-review": {
      "description": "Escape room review",
      "referencesHeading": "참고 자료",
      "frontmatter": { "escape.cafe": { "research": "매장 이름과 지점" } },
      "sections": [{ "heading": "방에 들어가서", "research": "공식 시놉시스", "prompt": "첫인상과 분위기" }],
      "criteria": []
    }
  }
}
```

| 항목 | 필수 | 설명 |
|---|---|---|
| `default` | O | `template`을 생략했을 때 쓰는 템플릿 ID |
| `templates` | O | 템플릿 ID(소문자 kebab-case)별 템플릿. 하나 이상 |
| `description` | O | 도구 입력 설명에 나오는 한 줄 설명 |
| `referencesHeading` | O | 각주 설명 줄을 모으는 마지막 절의 제목. 규칙 검사가 쓴다 |
| `sections` | | 이런 글에 보통 들어가는 절. `heading`과, 조사해서 채울 `research`, 작성자에게 남길 `prompt` |
| `frontmatter` | | frontmatter 필드 경로별 `research`와 `prompt` |
| `criteria` | | `review_post`의 LLM 비평에 더할 기준 |

## Claude Code에 연결

```sh
claude mcp add --scope local writer -e SITE_ROOT=/path/to/site -- node /path/to/writer/dist/index.js
```

스키마, 템플릿, 안내 문서 파일은 도구를 호출할 때 바뀌었는지 보고 다시 읽는다. 사이트 스키마를 고쳤으면 `astro sync`로 스키마 파일만 다시 만들면 된다. 세션을 다시 시작해야 하는 경우는 둘이다. writer 코드를 고쳐 `npm run build`를 했을 때, 그리고 템플릿을 추가하거나 지웠을 때다. 템플릿 ID 목록은 도구 입력 스키마라서 시작할 때 정해진다.

## 사이트에 의존하지 않는 것

writer는 사이트의 에이전트 지시 문서(스킬, `CLAUDE.md` 등)를 읽지 않는다. 그런 문서가 없어도 같은 순서와 기준으로 돈다.

- **작업 순서**: 서버가 연결될 때 MCP instructions로 호출한 쪽에 알린다. 새 글은 `list_posts`와 `get_template`으로 시작하고, 저장할 때마다 `check_post`, 준비되면 `review_post`, 고를 때마다 `revise_post` 순서다.
- **글쓰기 원칙**: 지어내지 않기, 작성자 말투 유지, 글이 자기 자신을 설명하지 않기, 줄임말은 처음에 전체 이름으로, 각주 설명은 출처가 뒷받침하는 것만, 수정 흔적 남기지 않기. `src/writing/principles.ts`에 있고 초안, 검토, 수정에 모두 들어간다.
- **사이트 기준**: 사이트마다 다른 것만 `writer.guide.md`와 `writer.templates.json`에 둔다.

## 도구

### `list_posts`

글 폴더의 `.md`, `.mdx` 파일을 모두 frontmatter와 함께 돌려준다. 초안도 포함한다. 이미 다룬 소재나 링크할 글을 찾을 때 쓴다. 입력은 없고, LLM을 쓰지 않고 파일을 고치지 않는다.

응답은 경로 순이다. `post`는 다른 도구의 `path`로 그대로 넘길 수 있다. frontmatter를 읽지 못한 글은 빼지 않고 이유를 붙인다.

```
3 posts
notes/plain.md [error] frontmatter missing
sample/broken/index.md {"title":"깨진 글","pubDate":"2026-10-30",...}
sample/clean/index.md {"title":"깨끗한 글","description":"규칙을 모두 지킨 예시 글",...}
```

`structuredContent`는 `{ "posts": [{ "post": "...", "frontmatter": {...} }, { "post": "...", "error": "..." }] }` 모양이다.

### `get_template`

초안용 템플릿을 돌려준다. 초안은 이 도구를 부른 쪽이 조사하고 쓴다. LLM을 쓰지 않고 파일을 고치지 않는다.

| 입력 | 설명 |
|---|---|
| `template` | 글 템플릿. 생략하면 파일의 `default` |

응답에는 템플릿의 `frontmatter`, `sections`와 초안 작성 지침 `instructions`가 들어 있다. 지침의 요지는 다음과 같다.

- 절은 가이드라인이다. 글에 맞게 바꾸거나 뺀다.
- `research`는 공개 자료를 조사해 쓰고 각주를 단다. 직접 읽은 페이지만 인용한다.
- `prompt`는 작성자가 직접 쓸 내용이다. 감상이나 경험을 지어내지 않고 `<!-- TODO: ... -->` 주석으로 남긴다. 사이트에는 보이지 않는다.
- TODO는 템플릿의 `prompt`와, 값이 없는 필수 frontmatter 필드에만 단다. 선택 필드는 TODO 없이 뺀다.
- 스키마가 허용하지 않는 값처럼 글 밖의 문제는 파일에 남기지 않고 작성자에게 말한다.
- 검색으로 못 찾거나 페이지를 못 읽으면 브라우저 도구로 연다. 브라우저 도구가 없으면 작성자에게 링크나 문구를 요청한다.
- `list_posts`로 겹치는 소재와 링크할 글을 먼저 본다.
- 새 파일에 `draft: true`로 저장하고 `check_post`로 검사한다.

`criteria`는 검토용이라 응답에 넣지 않는다.

### `check_post`

글 하나를 규칙으로 검사한다. LLM을 쓰지 않고 파일을 고치지 않는다.

| 입력 | 설명 |
|---|---|
| `path` | 글 폴더 기준 경로. 폴더(`notes/hello`)나 파일(`notes/hello/index.md`) |
| `template` | 글 템플릿. 생략하면 `article` |

입력 `{ "path": "sample/broken" }`의 응답이다. 줄 번호는 원문 기준이다.

```
sample/broken/index.md: error 3, warning 1, info 0
L1 [error] frontmatter: must have required property 'description'
L4 [warning] frontmatter: unknown field 'thumbnial': not in the site schema
L5 [error] frontmatter: thumbnail file not found: ./없는파일.png
L6 [error] frontmatter: accent: must be equal to one of the allowed values
```

같은 내용이 `structuredContent`로도 나간다. `passed`는 error와 warning이 하나도 없을 때 `true`다.

```json
{
  "post": "sample/broken/index.md",
  "template": "article",
  "passed": false,
  "counts": { "error": 3, "warning": 1, "info": 0 },
  "violations": [
    { "rule": "frontmatter", "severity": "error", "message": "must have required property 'description'", "line": 1 }
  ]
}
```

(`violations`는 첫 항목만 옮겼다.)

없는 글이나 글 폴더 밖의 경로는 `isError: true`와 함께 `post not found: sample/nope`처럼 답한다.

### `review_post`

`check_post`와 같은 규칙 검사에 LLM 비평을 더한다. 파일을 고치지 않는다. 입력은 `check_post`와 같다. LLM을 호출하므로 사용 한도나 요금이 든다.

비평 기준은 writer의 내장 글쓰기 원칙에 `WRITER_GUIDE` 문서와 템플릿의 `criteria`를 더한 것이다. 규칙 검사에서 위반이 나와도 비평은 돌린다.

응답은 `check_post`에 `issues`가 붙은 모양이다. `passed`는 규칙 검사를 통과하고 `issues`가 비어 있을 때 `true`다. 지적의 `severity`는 작성자가 볼 우선순위다. 거짓일 가능성이 높은 주장은 `error`, 나머지는 `warning`이다. 비평 지적은 자동으로 고치지 않는다.

```json
{
  "post": "sample/clean/index.md",
  "template": "article",
  "passed": false,
  "counts": { "error": 0, "warning": 0, "info": 0 },
  "violations": [],
  "issues": [
    { "severity": "error", "quote": "이건 뒤에서 다룬다", "problem": "forward reference", "suggestion": "remove the sentence" }
  ]
}
```

(위 값은 형식을 보여 주는 예시다.)

### `revise_post`

글 하나의 수정 목록을 만든다. 한 번 호출이 한 회차이고 파일은 고치지 않는다. LLM을 호출하므로 사용 한도나 요금이 든다.

| 입력 | 설명 |
|---|---|
| `path`, `template` | `check_post`와 같다 |
| `issues` | `review_post`의 지적 중 고칠 것. 생략하면 규칙 error만 고친다 |
| `feedback` | 이번 회차에 대한 작성자의 지시 |

고칠 것은 규칙 error, `issues`, `feedback`이다. 규칙 warning은 넘기지 않는다. 셋 다 없으면 LLM을 호출하지 않고 `status: "nothing-to-fix"`로 답한다.

응답은 다음과 같다. 값은 형식을 보여 주는 예시다.

```
sample/clean/index.md: proposed, applied 1, rejected 1
[edit 1] "title: '깨끗한 글'" -> "title: '규칙 예시'"
[rejected: not-found] "없는 문장" -> "x"
after edits: error 0, warning 0, info 0
```

- `applied`는 앞에서부터 순서대로 적용해야 한다. 각 `quote`는 앞의 수정을 적용한 글에서 정확히 한 번 나온다.
- `rejected`는 `quote`가 글에 없거나(`not-found`) 여러 번 나와서(`ambiguous`) 뺀 수정이다.
- `counts`와 `violations`는 `applied`를 모두 적용한 글을 검사한 결과다.

작성자가 수정을 확인하고 승인한 것만 파일에 적용한다. 다음 회차는 적용된 파일을 다시 읽으므로, 남은 문제는 `feedback`과 함께 다시 호출하면 된다.

## 개발

```sh
npm test            # 테스트
npm run typecheck   # 타입 검사
npm run dev         # 빌드 없이 서버 실행
```

```
src/
├─ index.ts        실행 진입점. 설정을 읽고 stdio로 서버를 연결
├─ config.ts       환경변수와 스키마 파일 읽기
├─ content/        글 찾기, frontmatter 자르기와 해석, 본문 파싱
├─ rules/          규칙과 실행기. 글을 받아 위반 목록을 돌려주는 순수 함수
├─ templates/      템플릿 파일 읽기
├─ llm/            LLM Provider
├─ writing/        내장 글쓰기 원칙, 사이트 안내 문서 읽기
├─ review/         LLM 비평 요청과 응답 형식
├─ loop/           수정 한 회차: 수정 목록 요청, 적용, 재검사
└─ mcp/            MCP 서버와 도구 등록
```
