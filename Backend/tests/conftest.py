import sys

import python_multipart

# Ensure tests load python_multipart instead of the deprecated multipart alias.
sys.modules["multipart"] = python_multipart
