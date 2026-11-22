use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::env;
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::{Path, PathBuf};
use tokenizers::Tokenizer;

#[derive(Serialize, Deserialize)]
struct TokenizeResponse {
    success: bool,
    tokens: Vec<u32>,
    count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct RagSearchResult {
    #[serde(rename = "filePath")]
    file_path: String,
    #[serde(rename = "relativePath")]
    relative_path: String,
    #[serde(rename = "startLine")]
    start_line: usize,
    #[serde(rename = "endLine")]
    end_line: usize,
    snippet: String,
    score: i32,
}

#[derive(Serialize)]
struct RagCliResponse {
    success: bool,
    results: Vec<RagSearchResult>,
    total: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Deserialize)]
struct RpcRequest {
    action: String,
    #[serde(default)]
    path: String,
    #[serde(default)]
    text: String,
    #[serde(default)]
    tokens: Vec<u32>,
    #[serde(default)]
    root_path: String,
    #[serde(default)]
    query: String,
    #[serde(default)]
    limit: Option<usize>,
}

#[derive(Serialize)]
struct RpcResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tokens: Option<Vec<u32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    vocab_size: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    rag_results: Option<Vec<RagSearchResult>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn get_ignored_dirs() -> HashSet<&'static str> {
    let mut s = HashSet::new();
    s.insert("node_modules");
    s.insert(".git");
    s.insert(".localai");
    s.insert("dist");
    s.insert("dist-electron");
    s.insert("build");
    s.insert(".data");
    s.insert(".data_test");
    s.insert(".data_router_test");
    s.insert("__pycache__");
    s.insert(".vscode");
    s.insert(".idea");
    s.insert(".next");
    s.insert("target");
    s
}

fn get_binary_exts() -> HashSet<&'static str> {
    let mut s = HashSet::new();
    s.insert(".exe");
    s.insert(".dll");
    s.insert(".bin");
    s.insert(".gguf");
    s.insert(".iso");
    s.insert(".zip");
    s.insert(".tar");
    s.insert(".gz");
    s.insert(".png");
    s.insert(".jpg");
    s.insert(".jpeg");
    s.insert(".gif");
    s.insert(".webp");
    s.insert(".ico");
    s.insert(".pdf");
    s.insert(".mp4");
    s.insert(".mp3");
    s.insert(".wav");
    s.insert(".woff");
    s.insert(".woff2");
    s.insert(".ttf");
    s.insert(".eot");
    s
}

fn crawl_directory(
    root: &Path,
    current: &Path,
    depth: usize,
    ignored: &HashSet<&'static str>,
    binary_exts: &HashSet<&'static str>,
    files: &mut Vec<PathBuf>,
) {
    if depth > 8 {
        return;
    }
    let entries = match fs::read_dir(current) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if ignored.contains(name_str.as_ref()) {
            continue;
        }

        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };

        let path = entry.path();
        if file_type.is_dir() {
            crawl_directory(root, &path, depth + 1, ignored, binary_exts, files);
        } else if file_type.is_file() {
            if let Some(ext) = path.extension() {
                let ext_str = format!(".{}", ext.to_string_lossy().to_lowercase());
                if binary_exts.contains(ext_str.as_str()) {
                    continue;
                }
            }
            if let Ok(meta) = entry.metadata() {
                if meta.len() <= 500 * 1024 {
                    files.push(path);
                }
            }
        }
    }
}

fn perform_rag_search(root_path: &Path, query: &str, limit: usize) -> Vec<RagSearchResult> {
    let clean_query = query.trim().to_lowercase();
    if clean_query.is_empty() || !root_path.exists() {
        return vec![];
    }

    let mut terms: Vec<String> = clean_query
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.len() >= 2)
        .map(|s| s.to_string())
        .collect();
    terms.sort();
    terms.dedup();

    if terms.is_empty() {
        return vec![];
    }

    let ignored = get_ignored_dirs();
    let binary_exts = get_binary_exts();
    let mut files = Vec::new();
    crawl_directory(root_path, root_path, 0, &ignored, &binary_exts, &mut files);

    let mut results: Vec<RagSearchResult> = Vec::new();
    let chunk_size = 25;
    let overlap = 5;
    let step = chunk_size - overlap;

    for file_path in files {
        let content = match fs::read_to_string(&file_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let lines: Vec<&str> = content.lines().collect();
        if lines.is_empty() {
            continue;
        }

        let mut i = 0;
        while i < lines.len() {
            let end = (i + chunk_size).min(lines.len());
            let chunk_lines = &lines[i..end];
            let chunk_text = chunk_lines.join("\n");
            let lower_chunk = chunk_text.to_lowercase();

            let mut score = 0;
            let mut matched_term_count = 0;

            if clean_query.len() > 3 && lower_chunk.contains(&clean_query) {
                score += 15;
            }

            for term in &terms {
                if lower_chunk.contains(term) {
                    matched_term_count += 1;
                    let count = lower_chunk.matches(term).count();
                    score += ((count * 2) as i32).min(8);
                }
            }

            if matched_term_count > 1 {
                score += (matched_term_count as i32) * 3;
            }
            if matched_term_count == terms.len() && terms.len() > 1 {
                score += 10;
            }

            if score > 0 {
                let relative_path = file_path
                    .strip_prefix(root_path)
                    .map(|p| p.to_string_lossy().replace('\\', "/"))
                    .unwrap_or_else(|_| file_path.to_string_lossy().to_string());

                results.push(RagSearchResult {
                    file_path: file_path.to_string_lossy().to_string(),
                    relative_path,
                    start_line: i + 1,
                    end_line: end,
                    snippet: chunk_text,
                    score,
                });
            }

            i += step;
        }
    }

    results.sort_by(|a, b| b.score.cmp(&a.score));
    if results.len() > limit {
        results.truncate(limit);
    }
    results
}

fn main() {
    let args: Vec<String> = env::args().collect();

    // Mode 1: Direct CLI encode
    // rust-tokenizer encode <tokenizer_json_path> <text_to_encode>
    if args.len() >= 4 && args[1] == "encode" {
        let tokenizer_path = &args[2];
        let text = &args[3..].join(" ");

        match Tokenizer::from_file(Path::new(tokenizer_path)) {
            Ok(tokenizer) => match tokenizer.encode(text.as_str(), true) {
                Ok(encoding) => {
                    let ids = encoding.get_ids().to_vec();
                    let count = ids.len();
                    let resp = TokenizeResponse {
                        success: true,
                        tokens: ids,
                        count,
                        error: None,
                    };
                    println!("{}", serde_json::to_string(&resp).unwrap());
                }
                Err(e) => {
                    let resp = TokenizeResponse {
                        success: false,
                        tokens: vec![],
                        count: 0,
                        error: Some(format!("Encoding error: {}", e)),
                    };
                    println!("{}", serde_json::to_string(&resp).unwrap());
                }
            },
            Err(e) => {
                let resp = TokenizeResponse {
                    success: false,
                    tokens: vec![],
                    count: 0,
                    error: Some(format!("Failed to load tokenizer from {}: {}", tokenizer_path, e)),
                };
                println!("{}", serde_json::to_string(&resp).unwrap());
            }
        }
        return;
    }

    // Mode 2: Direct CLI RAG Search
    // rust-tokenizer rag <root_path> <query> [limit]
    if args.len() >= 4 && args[1] == "rag" {
        let root_path = Path::new(&args[2]);
        let query = &args[3];
        let limit = if args.len() >= 5 {
            args[4].parse::<usize>().unwrap_or(8)
        } else {
            8
        };

        let results = perform_rag_search(root_path, query, limit);
        let resp = RagCliResponse {
            total: results.len(),
            results,
            success: true,
            error: None,
        };
        println!("{}", serde_json::to_string(&resp).unwrap());
        return;
    }

    // Mode 3: Daemon / Interactive Stdin-Stdout JSON-RPC
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut current_tokenizer: Option<Tokenizer> = None;
    let mut current_path = String::new();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let req: Result<RpcRequest, _> = serde_json::from_str(trimmed);
        let resp = match req {
            Ok(req) => match req.action.as_str() {
                "load" => {
                    match Tokenizer::from_file(Path::new(&req.path)) {
                        Ok(t) => {
                            let vocab_size = t.get_vocab_size(true);
                            current_tokenizer = Some(t);
                            current_path = req.path.clone();
                            RpcResponse {
                                success: true,
                                action: Some("load".to_string()),
                                tokens: None,
                                count: None,
                                text: None,
                                vocab_size: Some(vocab_size),
                                rag_results: None,
                                error: None,
                            }
                        }
                        Err(e) => RpcResponse {
                            success: false,
                            action: Some("load".to_string()),
                            tokens: None,
                            count: None,
                            text: None,
                            vocab_size: None,
                            rag_results: None,
                            error: Some(format!("Failed to load {}: {}", req.path, e)),
                        },
                    }
                }
                "encode" => {
                    if !req.path.is_empty() && (current_tokenizer.is_none() || current_path != req.path) {
                        if let Ok(t) = Tokenizer::from_file(Path::new(&req.path)) {
                            current_tokenizer = Some(t);
                            current_path = req.path.clone();
                        }
                    }

                    match &current_tokenizer {
                        Some(tokenizer) => match tokenizer.encode(req.text.as_str(), true) {
                            Ok(encoding) => {
                                let ids = encoding.get_ids().to_vec();
                                let count = ids.len();
                                RpcResponse {
                                    success: true,
                                    action: Some("encode".to_string()),
                                    tokens: Some(ids),
                                    count: Some(count),
                                    text: None,
                                    vocab_size: None,
                                    rag_results: None,
                                    error: None,
                                }
                            }
                            Err(e) => RpcResponse {
                                success: false,
                                action: Some("encode".to_string()),
                                tokens: None,
                                count: None,
                                text: None,
                                vocab_size: None,
                                rag_results: None,
                                error: Some(format!("Encoding error: {}", e)),
                            },
                        },
                        None => RpcResponse {
                            success: false,
                            action: Some("encode".to_string()),
                            tokens: None,
                            count: None,
                            text: None,
                            vocab_size: None,
                            rag_results: None,
                            error: Some("No tokenizer loaded yet. Send {\"action\": \"load\", \"path\": \"...\"} first".to_string()),
                        },
                    }
                }
                "decode" => {
                    match &current_tokenizer {
                        Some(tokenizer) => match tokenizer.decode(&req.tokens, true) {
                            Ok(text) => RpcResponse {
                                success: true,
                                action: Some("decode".to_string()),
                                tokens: None,
                                count: None,
                                text: Some(text),
                                vocab_size: None,
                                rag_results: None,
                                error: None,
                            },
                            Err(e) => RpcResponse {
                                success: false,
                                action: Some("decode".to_string()),
                                tokens: None,
                                count: None,
                                text: None,
                                vocab_size: None,
                                rag_results: None,
                                error: Some(format!("Decode error: {}", e)),
                            },
                        },
                        None => RpcResponse {
                            success: false,
                            action: Some("decode".to_string()),
                            tokens: None,
                            count: None,
                            text: None,
                            vocab_size: None,
                            rag_results: None,
                            error: Some("No tokenizer loaded".to_string()),
                        },
                    }
                }
                "rag_search" => {
                    let root = Path::new(&req.root_path);
                    let limit = req.limit.unwrap_or(8);
                    let results = perform_rag_search(root, &req.query, limit);
                    RpcResponse {
                        success: true,
                        action: Some("rag_search".to_string()),
                        tokens: None,
                        count: Some(results.len()),
                        text: None,
                        vocab_size: None,
                        rag_results: Some(results),
                        error: None,
                    }
                }
                "status" => RpcResponse {
                    success: current_tokenizer.is_some(),
                    action: Some("status".to_string()),
                    tokens: None,
                    count: None,
                    text: if current_tokenizer.is_some() { Some(current_path.clone()) } else { None },
                    vocab_size: current_tokenizer.as_ref().map(|t| t.get_vocab_size(true)),
                    rag_results: None,
                    error: None,
                },
                _ => RpcResponse {
                    success: false,
                    action: Some(req.action),
                    tokens: None,
                    count: None,
                    text: None,
                    vocab_size: None,
                    rag_results: None,
                    error: Some("Unknown action. Supported: load, encode, decode, rag_search, status".to_string()),
                },
            },
            Err(e) => RpcResponse {
                success: false,
                action: None,
                tokens: None,
                count: None,
                text: None,
                vocab_size: None,
                rag_results: None,
                error: Some(format!("Invalid JSON request: {}", e)),
            },
        };

        if let Ok(json_str) = serde_json::to_string(&resp) {
            let _ = writeln!(stdout, "{}", json_str);
            let _ = stdout.flush();
        }
    }
}
