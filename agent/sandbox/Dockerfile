# Sandbox for agent 001's Hermes terminal, file and code tools. Holds only the tools' runtime;
# the agent's home and its own account credentials are bind-mounted by Hermes (see hermes-terminal.yaml).
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends bash ca-certificates curl git jq python3 ripgrep procps socat \
  && rm -rf /var/lib/apt/lists/*
COPY entry.sh /usr/local/bin/sandbox-entry
ENTRYPOINT ["/usr/local/bin/sandbox-entry"]
