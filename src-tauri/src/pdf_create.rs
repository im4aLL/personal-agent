use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64;
use lopdf::content::{Content, Operation};
use lopdf::{Document, Object, Stream, dictionary};

// Caps keep a huge request from tying up the command for long.
const MAX_TITLE_CHARS: usize = 200;
const MAX_CONTENT_CHARS: usize = 100_000;

// A4 page in points, with comfortable margins.
const PAGE_WIDTH: f32 = 595.0;
const PAGE_HEIGHT: f32 = 842.0;
const MARGIN_X: f32 = 56.0;
const MARGIN_TOP: f32 = 64.0;
const MARGIN_BOTTOM: f32 = 64.0;

const BODY_SIZE: f32 = 11.0;
const BODY_LEADING: f32 = 15.0;
const TITLE_SIZE: f32 = 18.0;
const TITLE_LEADING: f32 = 24.0;
const H1_SIZE: f32 = 14.0;
const H1_LEADING: f32 = 19.0;
const H2_SIZE: f32 = 12.0;
const H2_LEADING: f32 = 17.0;
const FOOTER_SIZE: f32 = 9.0;

// Conservative average glyph width for Helvetica (fraction of font size).
// Slightly overestimates so wrapped lines never overflow the margin.
const AVG_GLYPH_WIDTH_FACTOR: f32 = 0.55;

struct StyledLine {
    text: String,
    font: &'static str,
    size: f32,
    leading: f32,
    indent: f32,
    space_before: f32,
}

#[tauri::command]
pub fn create_pdf(title: String, content: String) -> Result<String, String> {
    let title = truncate(&title, MAX_TITLE_CHARS);
    if title.trim().is_empty() {
        return Err("Title must not be empty.".to_string());
    }
    if content.trim().is_empty() {
        return Err("Content must not be empty.".to_string());
    }
    let content = truncate(&content, MAX_CONTENT_CHARS);

    let lines = layout(&title, &content);
    let bytes = render(&title, &lines).map_err(|error| format!("Failed to create PDF: {error}"))?;
    Ok(BASE64.encode(bytes))
}

fn truncate(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    text.chars().take(max_chars).collect()
}

/// Parse light markdown (headings, bullets, numbered items, paragraphs)
/// into styled lines, already word-wrapped to the usable page width.
fn layout(title: &str, content: &str) -> Vec<StyledLine> {
    let usable_width = PAGE_WIDTH - 2.0 * MARGIN_X;
    let mut lines: Vec<StyledLine> = wrap_words(title.trim(), max_chars_per_line(usable_width, TITLE_SIZE))
        .into_iter()
        .map(|text| StyledLine {
            text,
            font: "F2",
            size: TITLE_SIZE,
            leading: TITLE_LEADING,
            indent: 0.0,
            space_before: 0.0,
        })
        .collect();

    for paragraph in content.split('\n') {
        let paragraph = paragraph.trim_end();
        if paragraph.trim().is_empty() {
            lines.push(StyledLine {
                text: String::new(),
                font: "F1",
                size: BODY_SIZE,
                leading: BODY_LEADING / 2.0,
                indent: 0.0,
                space_before: 0.0,
            });
            continue;
        }

        let (marker, style) = if let Some(rest) = paragraph.strip_prefix("## ") {
            (rest, ("F2", H2_SIZE, H2_LEADING, 0.0, 8.0))
        } else if let Some(rest) = paragraph.strip_prefix("# ") {
            (rest, ("F2", H1_SIZE, H1_LEADING, 0.0, 10.0))
        } else if let Some(rest) = strip_bullet(paragraph) {
            (rest, ("F1", BODY_SIZE, BODY_LEADING, 18.0, 0.0))
        } else {
            (paragraph, ("F1", BODY_SIZE, BODY_LEADING, 0.0, 0.0))
        };
        let (font, size, leading, indent, space_before) = style;

        let prefix = if indent > 0.0 { "• " } else { "" };
        let max_chars = max_chars_per_line(usable_width - indent, size);
        let mut first = true;
        for wrapped in wrap_words(&format!("{prefix}{}", marker.trim()), max_chars) {
            lines.push(StyledLine {
                text: if first {
                    wrapped
                } else {
                    format!("  {wrapped}")
                },
                font,
                size,
                leading,
                indent,
                space_before: if first { space_before } else { 0.0 },
            });
            first = false;
        }
    }

    lines
}

fn strip_bullet(paragraph: &str) -> Option<&str> {
    paragraph
        .strip_prefix("- ")
        .or_else(|| paragraph.strip_prefix("* "))
        .or_else(|| {
            // Numbered item ("1. ", "12) ", ...).
            let mut chars = paragraph.chars();
            let digits: String = chars.by_ref().take_while(|c| c.is_ascii_digit()).collect();
            if digits.is_empty() {
                return None;
            }
            let rest: String = chars.collect();
            rest.strip_prefix(". ").or_else(|| rest.strip_prefix(") ")).map(|_| {
                let skip = digits.len() + 2;
                &paragraph[skip..]
            })
        })
}

fn max_chars_per_line(width: f32, size: f32) -> usize {
    ((width / (size * AVG_GLYPH_WIDTH_FACTOR)) as usize).max(20)
}

/// Greedy word wrap; overlong words are hard-split.
fn wrap_words(text: &str, max_chars: usize) -> Vec<String> {
    let mut wrapped = Vec::new();
    let mut current = String::new();

    for word in text.split_whitespace() {
        if word.chars().count() > max_chars {
            if !current.is_empty() {
                wrapped.push(std::mem::take(&mut current));
            }
            let mut chunk = String::new();
            for c in word.chars() {
                chunk.push(c);
                if chunk.chars().count() >= max_chars {
                    wrapped.push(std::mem::take(&mut chunk));
                }
            }
            if !chunk.is_empty() {
                current = chunk;
            }
            continue;
        }

        let extra = if current.is_empty() { 0 } else { 1 };
        if current.chars().count() + extra + word.chars().count() > max_chars {
            wrapped.push(std::mem::take(&mut current));
        }
        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(word);
    }

    if !current.is_empty() {
        wrapped.push(current);
    }
    if wrapped.is_empty() {
        wrapped.push(String::new());
    }
    wrapped
}

fn render(title: &str, lines: &[StyledLine]) -> lopdf::Result<Vec<u8>> {
    let mut doc = Document::with_version("1.5");

    let info_id = doc.add_object(dictionary! {
        "Title" => Object::string_literal(encode_win_ansi(title)),
        "Creator" => Object::string_literal("personal-agent"),
    });

    let pages_id = doc.new_object_id();
    let regular_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
        "Encoding" => "WinAnsiEncoding",
    });
    let bold_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica-Bold",
        "Encoding" => "WinAnsiEncoding",
    });
    let resources_id = doc.add_object(dictionary! {
        "Font" => dictionary! {
            "F1" => regular_id,
            "F2" => bold_id,
        },
    });

    // Paginate: group styled lines into pages.
    let mut pages: Vec<Vec<(StyledLine, f32)>> = vec![Vec::new()];
    let mut cursor_y = PAGE_HEIGHT - MARGIN_TOP;
    for line in lines {
        cursor_y -= line.space_before + line.leading;
        if cursor_y < MARGIN_BOTTOM {
            pages.push(Vec::new());
            cursor_y = PAGE_HEIGHT - MARGIN_TOP - line.space_before - line.leading;
        }
        let page = pages.last_mut().expect("at least one page");
        page.push((
            StyledLine {
                text: line.text.clone(),
                font: line.font,
                size: line.size,
                leading: line.leading,
                indent: line.indent,
                space_before: line.space_before,
            },
            cursor_y,
        ));
    }

    let page_count = pages.len();
    let mut kids = Vec::with_capacity(page_count);
    for (index, page_lines) in pages.iter().enumerate() {
        let mut operations = Vec::with_capacity(page_lines.len() * 5 + 5);
        for (line, y) in page_lines {
            if line.text.is_empty() {
                continue;
            }
            operations.push(Operation::new("BT", vec![]));
            operations.push(Operation::new(
                "Tf",
                vec![Object::Name(line.font.as_bytes().to_vec()), (line.size as i32).into()],
            ));
            operations.push(Operation::new(
                "Td",
                vec![
                    ((MARGIN_X + line.indent) as i32).into(),
                    (*y as i32).into(),
                ],
            ));
            operations.push(Operation::new(
                "Tj",
                vec![Object::string_literal(encode_win_ansi(&line.text))],
            ));
            operations.push(Operation::new("ET", vec![]));
        }

        // Footer with page number.
        let footer = format!("Page {} of {page_count}", index + 1);
        operations.push(Operation::new("BT", vec![]));
        operations.push(Operation::new(
            "Tf",
            vec![Object::Name(b"F1".to_vec()), (FOOTER_SIZE as i32).into()],
        ));
        operations.push(Operation::new(
            "Td",
            vec![
                ((PAGE_WIDTH / 2.0 - 30.0) as i32).into(),
                ((MARGIN_BOTTOM - 24.0) as i32).into(),
            ],
        ));
        operations.push(Operation::new(
            "Tj",
            vec![Object::string_literal(encode_win_ansi(&footer))],
        ));
        operations.push(Operation::new("ET", vec![]));

        let content = Content { operations };
        let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode()?));
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "Contents" => content_id,
        });
        kids.push(Object::Reference(page_id));
    }

    let page_dict = dictionary! {
        "Type" => "Pages",
        "Kids" => Object::Array(kids),
        "Count" => page_count as i32,
        "Resources" => resources_id,
        "MediaBox" => vec![0.into(), 0.into(), (PAGE_WIDTH as i32).into(), (PAGE_HEIGHT as i32).into()],
    };
    doc.objects.insert(pages_id, Object::Dictionary(page_dict));

    let catalog_id = doc.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    doc.trailer.set("Root", catalog_id);
    doc.trailer.set("Info", info_id);

    doc.compress();
    let mut bytes = Vec::new();
    doc.save_to(&mut bytes)?;
    Ok(bytes)
}

/// Encode text to WinAnsi (the declared font encoding). Characters outside
/// WinAnsi are replaced so the PDF never contains undecodable bytes.
fn encode_win_ansi(text: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(text.len());
    for c in text.chars() {
        if c.is_ascii() {
            out.push(c as u8);
            continue;
        }
        let mapped = match c {
            '€' => 0x80,
            '‚' => 0x82,
            'ƒ' => 0x83,
            '„' => 0x84,
            '…' => 0x85,
            '†' => 0x86,
            '‡' => 0x87,
            'ˆ' => 0x88,
            '‰' => 0x89,
            '‹' => 0x8B,
            '‘' => 0x91,
            '’' => 0x92,
            '“' => 0x93,
            '”' => 0x94,
            '–' => 0x96,
            '—' => 0x97,
            '˜' => 0x98,
            '™' => 0x99,
            '›' => 0x9B,
            '\u{a0}' => 0xA0,
            '¡'..='ÿ' => {
                // U+00A0..U+00FF map 1:1 onto WinAnsi 0xA0..0xFF.
                c as u32 as u8
            }
            '•' => 0x95,
            _ => b'?',
        };
        out.push(mapped);
    }
    out
}
