from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    Custom exception handler that always returns { message, status, fields }.
    Compatible with frontend apiClient.js error normaliser.
    """
    response = exception_handler(exc, context)

    if response is not None:
        status_code = response.status_code
        data = response.data

        message = "An error occurred."
        fields = None

        if isinstance(data, dict):
            if 'detail' in data:
                message = str(data['detail'])
            elif 'message' in data:
                message = str(data['message'])
            elif 'non_field_errors' in data:
                nfe = data['non_field_errors']
                message = str(nfe[0]) if isinstance(nfe, (list, tuple)) and len(nfe) > 0 else str(nfe)
            else:
                # If there are field errors, take the first field's error as message
                first_key = next(iter(data), None)
                if first_key:
                    first_val = data[first_key]
                    if isinstance(first_val, (list, tuple)) and len(first_val) > 0:
                        message = f"{first_key}: {first_val[0]}"
                    else:
                        message = f"{first_key}: {first_val}"

            # Extract fields dictionary
            field_errors = {}
            for key, val in data.items():
                if key not in ('detail', 'message'):
                    if isinstance(val, (list, tuple)):
                        field_errors[key] = [str(item) for item in val]
                    else:
                        field_errors[key] = [str(val)]
            if field_errors:
                fields = field_errors

        elif isinstance(data, (list, tuple)):
            if len(data) > 0:
                message = str(data[0])
            else:
                message = "Validation error."
        elif isinstance(data, str):
            message = data

        response.data = {
            'message': message,
            'status': status_code,
            'fields': fields
        }
        return response

    # Unhandled 500 error
    logger.exception("Unhandled server exception: %s", exc)
    return Response(
        {
            'message': 'An unexpected server error occurred. Please try again.',
            'status': status.HTTP_500_INTERNAL_SERVER_ERROR,
            'fields': None
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )
