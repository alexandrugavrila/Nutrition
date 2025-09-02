# Shared: Resolve a Python command tuple to run Python.
function Get-PythonCommand {
    if ($env:PYTHON) { return ,@($env:PYTHON) }
    elseif (Get-Command python  -ErrorAction SilentlyContinue) { return ,@("python") }
    elseif (Get-Command python3 -ErrorAction SilentlyContinue) { return ,@("python3") }
    elseif (Get-Command py      -ErrorAction SilentlyContinue) { return ,@("py","-3") }
    else { throw "Python is required but was not found on PATH" }
}

