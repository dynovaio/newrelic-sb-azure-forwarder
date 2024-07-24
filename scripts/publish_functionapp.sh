#! /bin/bash
# -----------------------------------------------------------------------------
# File:
# publish_function.sh
#
# Authors:
# Authors:
# * Martin Vuelta <zodiacfireworks@softbutterfly.io>
# * SoftButterfly Dev Team <dev@softbutterfly.io>
#
# Description:
# This script will publish the function app.
#
# Usage:
# ./publish_function.sh
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Preamble:
# ---------

# Global variables
PROJECT_NAME="nr-logforwarder"

# -----------------------------------------------------------------------------
# Execution:
# ----------

# Get random suffix from .random_sufix file
if [ -f .random_suffix ]; then
    RANDOM_SUFFIX=$(cat .random_suffix)
else
    echo "[ERR] Random suffix file not found."
    exit 1
fi

FUNCTION_APP_NAME="fn-${PROJECT_NAME}-${RANDOM_SUFFIX}"

npm install

func azure functionapp publish "${FUNCTION_APP_NAME}"
