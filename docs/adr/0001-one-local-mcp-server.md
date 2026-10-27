# One local MCP server, brand as a parameter

Brand OS could have shipped one MCP server per brand, or a hosted service. We
chose a single server that runs on the user's machine over stdio and takes the
brand as a parameter on every tool (list brands, get tokens, get reference, get
asset). One install then serves every brand, nothing is hosted or paid for, and
adding a brand never touches the agent's config. A hosted server is out of scope
for v1 and would be a new effort, not a resumption.

Settled while charting the wayfinder map: see
[One MCP server, brand as a parameter](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/4)
and [MCP server runs locally over stdio](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/5).
