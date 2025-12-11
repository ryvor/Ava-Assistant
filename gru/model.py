# gru/model.py
import torch
import torch.nn as nn
import random
from typing import List, Tuple
from pathlib import Path

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

class TinyGRU(nn.Module):
    def __init__(self, vocab_size: int, hidden_size: int, label_size: int):
        super().__init__()
        self.hidden_size = hidden_size
        self.char_emb = nn.Embedding(vocab_size, hidden_size)
        self.label_emb = nn.Embedding(label_size, hidden_size)
        self.gru = nn.GRU(hidden_size * 2, hidden_size, batch_first=True)
        self.fc = nn.Linear(hidden_size, vocab_size)

    def forward(self, input_idxs, label_idx, hidden=None):
        # input_idxs: (batch, seq_len)
        # label_idx: (batch,)
        char_vecs = self.char_emb(input_idxs)  # (batch, seq_len, hidden)
        label_vec = self.label_emb(label_idx).unsqueeze(1)  # (batch, 1, hidden)
        label_vec = label_vec.expand(-1, char_vecs.size(1), -1)  # repeat across time

        x = torch.cat([char_vecs, label_vec], dim=-1)
        out, hidden = self.gru(x, hidden)
        logits = self.fc(out)  # (batch, seq_len, vocab)
        return logits, hidden

def load_templates(path: str) -> List[Tuple[str, str]]:
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    pairs = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        label, text = line.split("|", 1)
        pairs.append((label.strip(), text.strip()))
    return pairs

class TemplateDataset(torch.utils.data.Dataset):
    def __init__(self, pairs: List[Tuple[str, str]], char_to_idx, label_to_idx):
        self.data = pairs
        self.char_to_idx = char_to_idx
        self.label_to_idx = label_to_idx

    def __len__(self):
        return len(self.data)

    def __getitem__(self, i):
        label, text = self.data[i]
        label_idx = self.label_to_idx[label]
        # add start/end tokens
        s = "<" + text + ">"
        x = torch.tensor([self.char_to_idx[c] for c in s], dtype=torch.long)
        return label_idx, x

def build_vocabs(pairs: List[Tuple[str, str]]):
    labels = sorted({lab for lab, _ in pairs})
    label_to_idx = {lab: i for i, lab in enumerate(labels)}

    chars = sorted({c for _, txt in pairs for c in "<>" + txt})
    char_to_idx = {c: i for i, c in enumerate(chars)}
    idx_to_char = {i: c for c, i in char_to_idx.items()}
    return label_to_idx, char_to_idx, idx_to_char

def collate(batch):
    label_idxs, seqs = zip(*batch)
    max_len = max(len(s) for s in seqs)
    padded = []
    for s in seqs:
        pad_len = max_len - len(s)
        padded.append(torch.cat([s, torch.full((pad_len,), 0, dtype=torch.long)]))
    # we’ll treat index 0 as whatever char; for a real project use dedicated PAD
    return torch.tensor(label_idxs, dtype=torch.long), torch.stack(padded)

def train_model(
    data_path: str,
    model_path: str,
    hidden_size: int = 256,
    epochs: int = 300,
    lr: float = 1e-3,
):
    pairs = load_templates(data_path)
    label_to_idx, char_to_idx, idx_to_char = build_vocabs(pairs)

    dataset = TemplateDataset(pairs, char_to_idx, label_to_idx)
    loader = torch.utils.data.DataLoader(dataset, batch_size=16, shuffle=True, collate_fn=collate)

    model = TinyGRU(vocab_size=len(char_to_idx), hidden_size=hidden_size, label_size=len(label_to_idx)).to(DEVICE)
    optim = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.CrossEntropyLoss()

    for epoch in range(epochs):
        total_loss = 0.0
        for label_idxs, x in loader:
            label_idxs = label_idxs.to(DEVICE)
            x = x.to(DEVICE)
            optim.zero_grad()
            logits, _ = model(x[:, :-1], label_idxs)  # predict next char
            loss = loss_fn(logits.reshape(-1, logits.size(-1)), x[:, 1:].reshape(-1))
            loss.backward()
            optim.step()
            total_loss += loss.item()
        print(f"Epoch {epoch+1}/{epochs}, loss={total_loss/len(loader):.4f}")

    torch.save(
        {
            "model_state": model.state_dict(),
            "label_to_idx": label_to_idx,
            "char_to_idx": char_to_idx,
            "idx_to_char": idx_to_char,
            "hidden_size": hidden_size,
        },
        model_path,
    )
    print(f"Saved model to {model_path}")

def load_trained(model_path: str) -> Tuple[TinyGRU, dict, dict, dict]:
    ckpt = torch.load(model_path, map_location=DEVICE)
    label_to_idx = ckpt["label_to_idx"]
    char_to_idx = ckpt["char_to_idx"]
    idx_to_char = ckpt["idx_to_char"]
    hidden_size = ckpt["hidden_size"]

    model = TinyGRU(len(char_to_idx), hidden_size, len(label_to_idx)).to(DEVICE)
    model.load_state_dict(ckpt["model_state"])
    model.eval()
    return model, label_to_idx, char_to_idx, idx_to_char

@torch.no_grad()
def generate_template(
    model: TinyGRU,
    label_to_idx,
    char_to_idx,
    idx_to_char,
    label: str,
    max_len: int = 160,
    temperature: float = 0.5,
) -> str:
    if label not in label_to_idx:
        # fallback: just return label as a plain string
        return f"[no template for label={label}]"

    label_idx = torch.tensor([label_to_idx[label]], dtype=torch.long, device=DEVICE)
    # start token
    input_idx = torch.tensor([[char_to_idx["<"]]], dtype=torch.long, device=DEVICE)
    hidden = None
    generated_chars: List[str] = []

    for _ in range(max_len):
        logits, hidden = model(input_idx, label_idx, hidden)
        last_logits = logits[0, -1, :] / temperature
        probs = torch.softmax(last_logits, dim=-1)
        idx = torch.multinomial(probs, num_samples=1).item()
        ch = idx_to_char[idx]
        if ch == ">":
            break
        generated_chars.append(ch)
        input_idx = torch.tensor([[idx]], dtype=torch.long, device=DEVICE)

    text = "".join(generated_chars).strip()
    return text
