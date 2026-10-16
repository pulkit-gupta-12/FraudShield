from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'pageSize'
    max_page_size = 500

    def get_page_size(self, request):
        if 'pageSize' in request.query_params:
            try:
                return min(int(request.query_params['pageSize']), self.max_page_size)
            except (ValueError, TypeError):
                pass
        elif 'page_size' in request.query_params:
            try:
                return min(int(request.query_params['page_size']), self.max_page_size)
            except (ValueError, TypeError):
                pass
        return self.page_size

    def get_paginated_response(self, data):
        return Response({
            'results': data,
            'count': self.page.paginator.count
        })
